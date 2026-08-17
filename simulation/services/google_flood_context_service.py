"""Optional PostGIS/OCHA context for Google Flood forecast geometries."""

from __future__ import annotations

from collections import Counter
import json
import logging
import unicodedata

from django.contrib.gis.geos import GEOSGeometry

from maps.models import AdministrativeBoundary, Infrastructure
from .admin_baseline_service import get_admin_baseline_payload


logger = logging.getLogger(__name__)
CONTEXT_METRICS = (
    "population_total",
    "population_female",
    "population_under_18",
    "population_60_plus",
    "pwd_planning_estimate",
    "idps_dtm_r22",
    "returnees_dtm_r22",
    "dtm_caseload",
)


def _normalize(value):
    normalized = unicodedata.normalize("NFKD", str(value or ""))
    return "".join(
        character for character in normalized
        if not unicodedata.combining(character)
    ).casefold().strip()


def _baseline_indexes():
    by_level_and_code = {}
    by_level_and_name = {}
    for level in (1, 2):
        payload = get_admin_baseline_payload(level=level)
        for area in payload["areas"]:
            by_level_and_code[(level, _normalize(area["pcode"]))] = area
            by_level_and_name[(level, _normalize(area["name"]))] = area
    return by_level_and_code, by_level_and_name


def _context_geometry(feature):
    geometry = feature.get("geometry")
    if not geometry or geometry.get("type") not in {
        "Point", "Polygon", "MultiPolygon",
    }:
        return None
    return GEOSGeometry(json.dumps(geometry), srid=4326)


def enrich_google_flood_context(payload):
    """Intersect forecast features with local Admin1/Admin2 and infrastructure.

    The returned population figures are the baseline totals of intersected
    administrative areas. They are context, not estimates of people affected.
    """

    context = {
        "available": True,
        "admin_areas": [],
        "infrastructure": {
            "total": 0,
            "by_type": {},
            "sample": [],
            "truncated": False,
        },
        "caveat": (
            "As áreas administrativas e infraestruturas são interseções espaciais de triagem. "
            "Os totais OCHA descrevem a população residente das áreas intersectadas e não a "
            "população diretamente afetada."
        ),
    }
    try:
        by_code, by_name = _baseline_indexes()
        area_matches = {}
        infrastructure_matches = {}
        feature_collection = payload.get("feature_collection", {})
        event_geometries = {}
        events_with_polygons = set()
        for feature in feature_collection.get("features", []):
            geometry = _context_geometry(feature)
            if geometry is None:
                continue
            event_id = feature.get("properties", {}).get("event_id") or "unassigned"
            current_geometry = event_geometries.get(event_id)
            event_geometries[event_id] = (
                current_geometry.union(geometry) if current_geometry else geometry
            )
            if geometry.geom_type in ("Polygon", "MultiPolygon"):
                events_with_polygons.add(event_id)

        for event_id, geometry in event_geometries.items():
            for boundary in AdministrativeBoundary.objects.filter(
                level__in=(1, 2), geometry__intersects=geometry
            ).only("id", "name", "code", "level", "parent_id"):
                key = (boundary.level, boundary.id)
                match = area_matches.setdefault(key, {
                    "level": boundary.level,
                    "boundary_id": boundary.id,
                    "name": boundary.name,
                    "code": boundary.code,
                    "event_ids": set(),
                })
                if event_id != "unassigned":
                    match["event_ids"].add(event_id)

            if event_id not in events_with_polygons:
                continue
            for item in Infrastructure.objects.filter(
                geometry__intersects=geometry
            ).values("id", "name", "type", "capacity")[:501]:
                item = dict(item)
                existing = infrastructure_matches.get(item["id"])
                if existing:
                    if event_id != "unassigned":
                        existing["event_ids"].add(event_id)
                else:
                    item["event_ids"] = (
                        {event_id} if event_id != "unassigned" else set()
                    )
                    infrastructure_matches[item["id"]] = item

        admin_areas = []
        for area in area_matches.values():
            baseline = (
                by_code.get((area["level"], _normalize(area["code"])))
                or by_name.get((area["level"], _normalize(area["name"])))
            )
            admin_areas.append({
                **area,
                "pcode": baseline.get("pcode") if baseline else area["code"],
                "parent_name": baseline.get("parent_name") if baseline else None,
                "metrics": {
                    key: baseline.get("metrics", {}).get(key)
                    for key in CONTEXT_METRICS
                } if baseline else None,
                "data_quality": baseline.get("data_quality") if baseline else None,
                "event_ids": sorted(area["event_ids"]),
            })
        admin_areas.sort(key=lambda area: (area["level"], area["name"]))
        context["admin_areas"] = admin_areas

        infrastructure_items = [
            {**item, "event_ids": sorted(item["event_ids"])}
            for item in infrastructure_matches.values()
        ]
        context["infrastructure"] = {
            "total": min(len(infrastructure_items), 500),
            "by_type": dict(Counter(item["type"] for item in infrastructure_items[:500])),
            "sample": infrastructure_items[:20],
            "truncated": len(infrastructure_items) > 500,
        }
        context["summary"] = {
            "admin1_count": sum(area["level"] == 1 for area in admin_areas),
            "admin2_count": sum(area["level"] == 2 for area in admin_areas),
            "admin2_baseline_population": sum(
                area["metrics"]["population_total"]
                for area in admin_areas
                if area["level"] == 2
                and area.get("metrics", {}).get("population_total") is not None
            ),
        }
    except Exception as exc:
        logger.warning("Google Flood local context unavailable: %s", exc)
        context.update({
            "available": False,
            "message": "O contexto Admin1/Admin2 local não está disponível neste momento.",
        })
    return context
