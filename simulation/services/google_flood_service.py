"""Google Flood Forecasting API adapter for live Mozambique alerts.

The API key is used only by Django. Responses are normalized before they reach
the browser, and Google KML polygons are converted to GeoJSON server-side.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
import hashlib
import json
import logging
import re
import socket
from urllib import error as urllib_error
from urllib import parse as urllib_parse
from urllib import request as urllib_request
from xml.etree import ElementTree

from django.conf import settings
from django.core.cache import cache


logger = logging.getLogger(__name__)

DEFAULT_COUNTRY_CODE = "MZ"
ACTIVE_SEVERITIES = {"ABOVE_NORMAL", "SEVERE", "EXTREME"}
SEVERITY_LABELS = {
    "ABOVE_NORMAL": "Acima do normal",
    "SEVERE": "Severa",
    "EXTREME": "Extrema",
    "NO_FLOODING": "Sem cheia",
    "UNKNOWN": "Desconhecida",
}
TREND_LABELS = {
    "RISE": "A subir",
    "FALL": "A descer",
    "NO_CHANGE": "Estável",
}
PROVIDER = {
    "name": "Google Flood Forecasting API",
    "attribution": "Google Flood Forecasting",
    "license": "CC BY 4.0",
    "documentation_url": "https://developers.google.com/flood-forecasting",
    "flood_hub_url": "https://sites.research.google/floods/",
}
_COUNTRY_CODE_RE = re.compile(r"^[A-Z]{2}$")
_MAX_RESPONSE_BYTES = 25 * 1024 * 1024


class GoogleFloodError(RuntimeError):
    """Base error for the Google Flood Forecasting integration."""

    def __init__(self, message, *, status_code=502, retryable=True):
        super().__init__(message)
        self.status_code = status_code
        self.retryable = retryable


class GoogleFloodConfigurationError(GoogleFloodError):
    """Raised when live API access is not enabled on the server."""

    def __init__(self, message):
        super().__init__(message, status_code=503, retryable=False)


def validate_country_code(value):
    country_code = str(value or DEFAULT_COUNTRY_CODE).strip().upper()
    if not _COUNTRY_CODE_RE.fullmatch(country_code):
        raise ValueError("country deve ser um código ISO 3166 alpha-2, como MZ.")
    return country_code


def build_flood_hub_url(latitude=-18.6657, longitude=35.5296, zoom=5.4):
    """Build the public Flood Hub deep link used when API access is unavailable."""

    try:
        latitude = max(-90.0, min(90.0, float(latitude)))
        longitude = max(-180.0, min(180.0, float(longitude)))
        zoom = max(1.0, min(18.0, float(zoom)))
    except (TypeError, ValueError) as exc:
        raise ValueError("latitude, longitude e zoom devem ser numéricos.") from exc
    return f"https://sites.research.google/floods/l/{latitude:.6f}/{longitude:.6f}/{zoom:.2f}"


def get_google_flood_service_status():
    enabled = bool(getattr(settings, "GOOGLE_FLOOD_API_ENABLED", False))
    configured = bool(str(getattr(settings, "GOOGLE_FLOOD_API_KEY", "")).strip())
    ready = enabled and configured
    if ready:
        message = "API oficial pronta para consultar previsões em tempo real."
    elif not enabled:
        message = "Integração preparada; ative GOOGLE_FLOOD_API_ENABLED após a aprovação do acesso."
    else:
        message = "Defina GOOGLE_FLOOD_API_KEY no backend para ativar as previsões."
    return {
        "enabled": enabled,
        "configured": configured,
        "ready": ready,
        "message": message,
        "provider": PROVIDER,
        "fallback_url": build_flood_hub_url(),
    }


def _api_config():
    status = get_google_flood_service_status()
    if not status["ready"]:
        raise GoogleFloodConfigurationError(status["message"])
    return {
        "base_url": str(
            getattr(
                settings,
                "GOOGLE_FLOOD_API_BASE_URL",
                "https://floodforecasting.googleapis.com/v1",
            )
        ).rstrip("/"),
        "api_key": str(getattr(settings, "GOOGLE_FLOOD_API_KEY", "")).strip(),
        "timeout": max(
            2.0,
            float(getattr(settings, "GOOGLE_FLOOD_API_TIMEOUT_SECONDS", 15)),
        ),
        "cache_ttl": max(
            0,
            int(getattr(settings, "GOOGLE_FLOOD_API_CACHE_SECONDS", 600)),
        ),
        "max_polygons": max(
            0,
            min(60, int(getattr(settings, "GOOGLE_FLOOD_API_MAX_POLYGONS", 24))),
        ),
    }


def _safe_cache_get(key):
    try:
        return cache.get(key)
    except Exception as exc:  # Redis must not make the upstream API unusable.
        logger.debug("Google Flood cache read unavailable: %s", exc)
        return None


def _safe_cache_set(key, value, timeout):
    if timeout <= 0:
        return
    try:
        cache.set(key, value, timeout=timeout)
    except Exception as exc:
        logger.debug("Google Flood cache write unavailable: %s", exc)


def _upstream_error_message(http_status, response_body):
    detail = ""
    try:
        payload = json.loads(response_body.decode("utf-8", errors="replace"))
        detail = str(payload.get("error", {}).get("message", "")).strip()
    except (TypeError, ValueError, json.JSONDecodeError):
        detail = ""

    if http_status in (401, 403):
        return (
            "A Google Flood Forecasting API recusou as credenciais. Confirme a "
            "aprovação, a ativação da API e as restrições da chave."
        )
    if http_status == 429:
        return "A Google Flood Forecasting API atingiu o limite temporário de pedidos."
    if http_status >= 500:
        return "A Google Flood Forecasting API está temporariamente indisponível."
    if detail:
        return f"A Google Flood Forecasting API rejeitou o pedido: {detail[:400]}"
    return f"A Google Flood Forecasting API devolveu HTTP {http_status}."


def _request_json(path, *, payload=None, force_refresh=False):
    config = _api_config()
    method = "POST" if payload is not None else "GET"
    body = (
        json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
        if payload is not None
        else None
    )
    cache_material = f"{method}:{path}:".encode("utf-8") + (body or b"")
    cache_key = "google-flood:v1:" + hashlib.sha256(cache_material).hexdigest()
    if not force_refresh:
        cached = _safe_cache_get(cache_key)
        if cached is not None:
            return cached

    api_request = urllib_request.Request(
        f"{config['base_url']}{path}",
        data=body,
        method=method,
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
            "X-Goog-Api-Key": config["api_key"],
            "User-Agent": "SimGeo/1.0 Google-Flood-Adapter",
        },
    )
    try:
        with urllib_request.urlopen(api_request, timeout=config["timeout"]) as response:
            response_body = response.read(_MAX_RESPONSE_BYTES + 1)
    except urllib_error.HTTPError as exc:
        error_body = exc.read(64 * 1024)
        message = _upstream_error_message(exc.code, error_body)
        raise GoogleFloodError(
            message,
            status_code=503 if exc.code in (429, 500, 502, 503, 504) else 502,
            retryable=exc.code not in (400, 401, 403),
        ) from exc
    except (urllib_error.URLError, TimeoutError, socket.timeout) as exc:
        raise GoogleFloodError(
            "Não foi possível contactar a Google Flood Forecasting API dentro do tempo esperado.",
            status_code=503,
        ) from exc

    if len(response_body) > _MAX_RESPONSE_BYTES:
        raise GoogleFloodError("A resposta da Google Flood Forecasting API excedeu o limite seguro.")
    try:
        result = json.loads(response_body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise GoogleFloodError("A Google Flood Forecasting API devolveu JSON inválido.") from exc

    _safe_cache_set(cache_key, result, config["cache_ttl"])
    return result


def _parse_coordinate_text(value):
    coordinates = []
    for token in str(value or "").replace("\n", " ").split():
        parts = token.split(",")
        if len(parts) < 2:
            continue
        try:
            coordinate = [float(parts[0]), float(parts[1])]
        except ValueError:
            continue
        coordinates.append(coordinate)
    if len(coordinates) >= 3 and coordinates[0] != coordinates[-1]:
        coordinates.append(coordinates[0])
    return coordinates


def parse_kml_to_geojson(kml, *, properties=None):
    """Convert Polygon/MultiGeometry KML returned by Google into GeoJSON."""

    try:
        root = ElementTree.fromstring(kml)
    except (TypeError, ElementTree.ParseError) as exc:
        raise GoogleFloodError("A API devolveu um polígono KML inválido.") from exc

    polygons = []
    for polygon_element in root.findall(".//{*}Polygon"):
        outer = polygon_element.find(
            "./{*}outerBoundaryIs/{*}LinearRing/{*}coordinates"
        )
        outer_coordinates = _parse_coordinate_text(outer.text if outer is not None else "")
        if len(outer_coordinates) < 4:
            continue
        rings = [outer_coordinates]
        for inner in polygon_element.findall(
            "./{*}innerBoundaryIs/{*}LinearRing/{*}coordinates"
        ):
            inner_coordinates = _parse_coordinate_text(inner.text)
            if len(inner_coordinates) >= 4:
                rings.append(inner_coordinates)
        polygons.append(rings)

    if not polygons:
        raise GoogleFloodError("O KML da API não contém polígonos utilizáveis.")
    geometry = (
        {"type": "Polygon", "coordinates": polygons[0]}
        if len(polygons) == 1
        else {"type": "MultiPolygon", "coordinates": polygons}
    )
    return {
        "type": "Feature",
        "properties": dict(properties or {}),
        "geometry": geometry,
    }


def _get_serialized_polygon(polygon_id, *, force_refresh=False):
    polygon_id = str(polygon_id or "").strip()
    if not polygon_id or len(polygon_id) > 1024:
        raise GoogleFloodError("A API devolveu um identificador de polígono inválido.")
    encoded_id = urllib_parse.quote(polygon_id, safe="")
    response = _request_json(
        f"/serializedPolygons/{encoded_id}",
        force_refresh=force_refresh,
    )
    kml = response.get("kml")
    if not kml:
        raise GoogleFloodError("A API não devolveu a geometria KML solicitada.")
    return kml


def _as_location(value):
    try:
        latitude = float(value["latitude"])
        longitude = float(value["longitude"])
    except (KeyError, TypeError, ValueError):
        return None
    return {"latitude": latitude, "longitude": longitude}


def _flash_valid_until(issue_time, period_hours):
    try:
        issue = datetime.fromisoformat(str(issue_time).replace("Z", "+00:00"))
        return (issue + timedelta(hours=int(period_hours))).astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    except (TypeError, ValueError):
        return None


def _normalize_riverine(raw_statuses):
    events = []
    point_features = []
    polygon_specs = []
    raw_severity_counts = {}
    for raw in raw_statuses:
        severity = raw.get("severity", "UNKNOWN")
        raw_severity_counts[severity] = raw_severity_counts.get(severity, 0) + 1
        if severity not in ACTIVE_SEVERITIES:
            continue
        gauge_id = str(raw.get("gaugeId") or "").strip()
        location = _as_location(raw.get("gaugeLocation"))
        event_id = f"riverine:{gauge_id or len(events) + 1}"
        trend = raw.get("forecastTrend")
        event = {
            "id": event_id,
            "gauge_id": gauge_id or None,
            "location": location,
            "severity": severity,
            "severity_label": SEVERITY_LABELS.get(severity, severity),
            "quality_verified": bool(raw.get("qualityVerified")),
            "issued_time": raw.get("issuedTime"),
            "forecast_time_range": raw.get("forecastTimeRange"),
            "forecast_trend": trend,
            "forecast_trend_label": TREND_LABELS.get(trend, trend),
            "forecast_change": raw.get("forecastChange"),
            "source": raw.get("source"),
            "map_inference_type": raw.get("mapInferenceType"),
            "inundation_map_type": raw.get("inundationMapSet", {}).get("inundationMapType"),
        }
        events.append(event)
        if location:
            point_features.append({
                "type": "Feature",
                "properties": {
                    "feature_kind": "river_gauge",
                    "alert_type": "riverine",
                    "event_id": event_id,
                    "severity": severity,
                    "severity_label": event["severity_label"],
                    "gauge_id": gauge_id,
                    "quality_verified": event["quality_verified"],
                    "source": event["source"],
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [location["longitude"], location["latitude"]],
                },
            })

        maps = raw.get("inundationMapSet", {}).get("inundationMaps", [])
        for inundation_map in maps:
            polygon_id = inundation_map.get("serializedPolygonId")
            if polygon_id:
                polygon_specs.append({
                    "polygon_id": polygon_id,
                    "properties": {
                        "feature_kind": "forecast_polygon",
                        "alert_type": "riverine",
                        "event_id": event_id,
                        "severity": severity,
                        "severity_label": event["severity_label"],
                        "probability_level": inundation_map.get("level"),
                        "map_type": event["inundation_map_type"],
                        "gauge_id": gauge_id,
                    },
                })
        if not maps and raw.get("serializedNotificationPolygonId"):
            polygon_specs.append({
                "polygon_id": raw["serializedNotificationPolygonId"],
                "properties": {
                    "feature_kind": "notification_polygon",
                    "alert_type": "riverine",
                    "event_id": event_id,
                    "severity": severity,
                    "severity_label": event["severity_label"],
                    "gauge_id": gauge_id,
                },
            })
    return events, point_features, polygon_specs, raw_severity_counts


def _normalize_flash_floods(raw_events):
    events = []
    polygon_specs = []
    for index, raw in enumerate(raw_events):
        event_id = f"flash:{raw.get('eventPolygonId') or index + 1}"
        event = {
            "id": event_id,
            "forecast_issue_time": raw.get("forecastIssueTime"),
            "forecast_period_hours": raw.get("forecastPeriodHours"),
            "valid_until": _flash_valid_until(
                raw.get("forecastIssueTime"), raw.get("forecastPeriodHours")
            ),
            "affected_country_codes": raw.get("affectedCountryCodes", []),
        }
        events.append(event)
        candidates = (
            ("HIGHLY_LIKELY", raw.get("highlyLikelyAffectedPolygonId")),
            ("LIKELY", raw.get("likelyAffectedPolygonId")),
            ("EVENT", raw.get("eventPolygonId")),
        )
        used = set()
        for likelihood, polygon_id in candidates:
            if not polygon_id or polygon_id in used:
                continue
            used.add(polygon_id)
            polygon_specs.append({
                "polygon_id": polygon_id,
                "properties": {
                    "feature_kind": "forecast_polygon",
                    "alert_type": "flash_flood",
                    "event_id": event_id,
                    "likelihood": likelihood,
                    "forecast_issue_time": event["forecast_issue_time"],
                    "valid_until": event["valid_until"],
                },
            })
    return events, polygon_specs


def _normalize_significant_events(raw_events, country_code):
    events = []
    polygon_specs = []
    for index, raw in enumerate(raw_events):
        countries = raw.get("affectedCountryCodes", [])
        if country_code not in countries:
            continue
        tracking_ids = raw.get("eventTrackingIds", [])
        event_id = f"significant:{tracking_ids[0] if tracking_ids else index + 1}"
        event = {
            "id": event_id,
            "event_interval": raw.get("eventInterval"),
            "affected_country_codes": countries,
            "affected_population": raw.get("affectedPopulation"),
            "area_km2": raw.get("areaKm2"),
            "gauge_ids": raw.get("gaugeIds", []),
            "event_tracking_ids": tracking_ids,
        }
        events.append(event)
        if raw.get("eventPolygonId"):
            polygon_specs.append({
                "polygon_id": raw["eventPolygonId"],
                "properties": {
                    "feature_kind": "forecast_polygon",
                    "alert_type": "significant_event",
                    "event_id": event_id,
                    "affected_population": event["affected_population"],
                    "area_km2": event["area_km2"],
                },
            })
    return events, polygon_specs


def _fetch_polygon_features(specs, *, force_refresh=False, limit=24):
    selected_specs = specs[:limit]
    if not selected_specs:
        return [], [], len(specs)

    kml_by_id = {}
    warnings = []
    polygon_ids = list(dict.fromkeys(spec["polygon_id"] for spec in selected_specs))
    with ThreadPoolExecutor(max_workers=min(4, len(polygon_ids))) as executor:
        futures = {
            executor.submit(
                _get_serialized_polygon,
                polygon_id,
                force_refresh=force_refresh,
            ): polygon_id
            for polygon_id in polygon_ids
        }
        for future in as_completed(futures):
            polygon_id = futures[future]
            try:
                kml_by_id[polygon_id] = future.result()
            except GoogleFloodError as exc:
                warnings.append(f"Polígono {polygon_id[:24]}… indisponível: {exc}")

    features = []
    for spec in selected_specs:
        kml = kml_by_id.get(spec["polygon_id"])
        if not kml:
            continue
        try:
            feature = parse_kml_to_geojson(kml, properties=spec["properties"])
            feature["properties"]["polygon_id"] = spec["polygon_id"]
            features.append(feature)
        except GoogleFloodError as exc:
            warnings.append(str(exc))
    return features, warnings, max(0, len(specs) - len(selected_specs))


def get_google_flood_forecast(
    *, country_code=DEFAULT_COUNTRY_CODE, include_polygons=True, force_refresh=False
):
    """Return normalized riverine, flash-flood and significant-event forecasts."""

    country_code = validate_country_code(country_code)
    config = _api_config()
    requests = {
        "riverine": (
            "/floodStatus:searchLatestFloodStatusByArea",
            {
                "regionCode": country_code,
                "pageSize": 20000,
                "includeNonQualityVerified": False,
            },
        ),
        "flash": (
            "/flashFloods:search",
            {"countryCodes": [country_code], "pageSize": 1000},
        ),
        "significant": (
            "/significantEvents:search",
            {"pageSize": 1000},
        ),
    }
    raw = {}
    warnings = []
    errors = []
    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = {
            executor.submit(
                _request_json,
                path,
                payload=payload,
                force_refresh=force_refresh,
            ): name
            for name, (path, payload) in requests.items()
        }
        for future in as_completed(futures):
            name = futures[future]
            try:
                raw[name] = future.result()
            except GoogleFloodError as exc:
                errors.append(exc)
                warnings.append(f"Consulta {name} indisponível: {exc}")
                raw[name] = {}
    if len(errors) == len(requests):
        raise errors[0]

    riverine, point_features, river_specs, severity_counts = _normalize_riverine(
        raw["riverine"].get("floodStatuses", [])
    )
    flash_floods, flash_specs = _normalize_flash_floods(
        raw["flash"].get("flashFloodEvents", [])
    )
    significant_events, significant_specs = _normalize_significant_events(
        raw["significant"].get("significantEvents", []), country_code
    )

    polygon_features = []
    omitted_polygon_count = 0
    if include_polygons:
        polygon_features, polygon_warnings, omitted_polygon_count = _fetch_polygon_features(
            flash_specs + significant_specs + river_specs,
            force_refresh=force_refresh,
            limit=config["max_polygons"],
        )
        warnings.extend(polygon_warnings)
        if omitted_polygon_count:
            warnings.append(
                f"{omitted_polygon_count} polígonos foram omitidos para manter a resposta leve."
            )

    return {
        "country_code": country_code,
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "provider": PROVIDER,
        "fallback_url": build_flood_hub_url(),
        "riverine": riverine,
        "flash_floods": flash_floods,
        "significant_events": significant_events,
        "feature_collection": {
            "type": "FeatureCollection",
            "features": polygon_features + point_features,
        },
        "summary": {
            "riverine_active": len(riverine),
            "riverine_statuses_checked": sum(severity_counts.values()),
            "riverine_severity_counts": severity_counts,
            "flash_flood_events": len(flash_floods),
            "significant_events": len(significant_events),
            "polygons_loaded": len(polygon_features),
            "polygons_omitted": omitted_polygon_count,
        },
        "warnings": warnings,
    }
