"""OCHA Mozambique Admin1/Admin2 baseline indicators and GEE choropleths."""

from __future__ import annotations

from collections import defaultdict
from functools import lru_cache
import json
from pathlib import Path
import unicodedata

import ee

from georisksim.gee_auth import initialize_gee
from .gaul_service import GAUL_NAME_FIELD, _get_admin_names


DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "ocha_baseline_2025.json"

INDICATORS = {
    "population_total": {
        "label": "População total",
        "group": "demography",
        "unit": "pessoas",
        "palette": ["172554", "1D4ED8", "22D3EE", "F8FAFC"],
    },
    "population_female": {
        "label": "População feminina",
        "group": "demography",
        "unit": "pessoas",
        "palette": ["3B0764", "A21CAF", "F472B6", "FDF2F8"],
    },
    "female_share": {
        "label": "Mulheres na população",
        "group": "demography",
        "unit": "%",
        "palette": ["312E81", "7C3AED", "EC4899", "FCE7F3"],
    },
    "population_under_5": {
        "label": "Crianças menores de 5",
        "group": "demography",
        "unit": "pessoas",
        "palette": ["052E16", "16A34A", "A3E635", "FEFCE8"],
    },
    "population_under_18": {
        "label": "Crianças e adolescentes (0–17)",
        "group": "demography",
        "unit": "pessoas",
        "palette": ["083344", "0891B2", "67E8F9", "ECFEFF"],
    },
    "under_18_share": {
        "label": "População com 0–17 anos",
        "group": "demography",
        "unit": "%",
        "palette": ["164E63", "06B6D4", "A5F3FC", "ECFEFF"],
    },
    "population_60_plus": {
        "label": "Pessoas com 60+ anos",
        "group": "demography",
        "unit": "pessoas",
        "palette": ["422006", "D97706", "FCD34D", "FFFBEB"],
    },
    "pwd_planning_estimate": {
        "label": "Pessoas com deficiência — estimativa",
        "group": "demography",
        "unit": "pessoas",
        "palette": ["2E1065", "7C3AED", "C4B5FD", "F5F3FF"],
        "caveat": "Estimativa de planeamento: 15% da população, não observação.",
    },
    "idps_dtm_r22": {
        "label": "Pessoas deslocadas internas (IDPs)",
        "group": "displacement",
        "unit": "pessoas",
        "palette": ["450A0A", "DC2626", "FB923C", "FFF7ED"],
    },
    "returnees_dtm_r22": {
        "label": "Pessoas retornadas",
        "group": "displacement",
        "unit": "pessoas",
        "palette": ["422006", "EA580C", "FACC15", "FEFCE8"],
    },
    "dtm_caseload": {
        "label": "Caseload combinado DTM",
        "group": "displacement",
        "unit": "pessoas",
        "palette": ["4C0519", "E11D48", "FB7185", "FFF1F2"],
        "caveat": "IDPs + retornados disponíveis na DTM R22; não equivale a deslocamento ativo.",
    },
    "dtm_caseload_rate": {
        "label": "Caseload DTM / população",
        "group": "displacement",
        "unit": "%",
        "palette": ["4C0519", "BE123C", "FB7185", "FFF1F2"],
        "caveat": "Razão indicativa entre o caseload combinado e a população projectada.",
    },
}


def _normalize(value):
    normalized = unicodedata.normalize("NFKD", str(value or ""))
    return "".join(
        character for character in normalized
        if not unicodedata.combining(character)
    ).casefold().strip()


def _sum_available(values):
    available = [value for value in values if value is not None]
    return sum(available) if available else None


def _ratio(numerator, denominator):
    if numerator is None or denominator in (None, 0):
        return None
    return round((numerator / denominator) * 100, 2)


@lru_cache(maxsize=1)
def load_admin_baseline():
    with DATA_PATH.open(encoding="utf-8") as fixture_file:
        return json.load(fixture_file)


def _metrics_from_values(population, displacement):
    idps = displacement.get("idps_dtm_r22")
    returnees = displacement.get("returnees_dtm_r22")
    caseload = _sum_available([idps, returnees])
    total = population.get("total")
    return {
        "population_total": total,
        "population_female": population.get("female"),
        "population_male": population.get("male"),
        "female_share": _ratio(population.get("female"), total),
        "population_under_5": population.get("under_5"),
        "population_under_18": population.get("under_18"),
        "under_18_share": _ratio(population.get("under_18"), total),
        "population_60_plus": population.get("age_60_plus"),
        "pwd_planning_estimate": population.get("pwd_planning_estimate"),
        "idps_dtm_r22": idps,
        "returnees_dtm_r22": returnees,
        "dtm_caseload": caseload,
        "dtm_caseload_rate": _ratio(caseload, total),
    }


def _displacement_status(displacement):
    available = sum(
        displacement.get(field) is not None
        for field in ("idps_dtm_r22", "returnees_dtm_r22")
    )
    return ("missing", "partial", "complete")[available]


def _admin2_areas(records):
    return [
        {
            "level": 2,
            "pcode": record["adm2_pcode"],
            "name": record["adm2_name"],
            "parent_pcode": record["adm1_pcode"],
            "parent_name": record["adm1_name"],
            "metrics": _metrics_from_values(record["population"], record["displacement"]),
            "data_quality": {
                "population": "available" if record["population"]["total"] is not None else "missing",
                "displacement": _displacement_status(record["displacement"]),
            },
        }
        for record in records
    ]


def _admin1_areas(records):
    groups = defaultdict(list)
    for record in records:
        groups[(record["adm1_pcode"], record["adm1_name"])].append(record)

    areas = []
    for (pcode, name), districts in sorted(groups.items()):
        population = {
            key: _sum_available(district["population"].get(key) for district in districts)
            for key in (
                "total", "female", "male", "under_5", "under_18",
                "age_60_plus",
            )
        }
        population["pwd_planning_estimate"] = (
            round(population["total"] * 0.15, 1)
            if population["total"] is not None else None
        )
        displacement = {
            key: _sum_available(district["displacement"].get(key) for district in districts)
            for key in ("idps_dtm_r22", "returnees_dtm_r22")
        }
        population_available = sum(
            district["population"]["total"] is not None for district in districts
        )
        idps_available = sum(
            district["displacement"]["idps_dtm_r22"] is not None
            for district in districts
        )
        returnees_available = sum(
            district["displacement"]["returnees_dtm_r22"] is not None
            for district in districts
        )
        areas.append({
            "level": 1,
            "pcode": pcode,
            "name": name,
            "parent_pcode": "MZ",
            "parent_name": "Moçambique",
            "metrics": _metrics_from_values(population, displacement),
            "data_quality": {
                "districts": len(districts),
                "population_available": population_available,
                "idps_available": idps_available,
                "returnees_available": returnees_available,
            },
        })
    return areas


def _filter_areas(areas, *, search="", admin1_pcode=None):
    normalized_search = _normalize(search)
    filtered = []
    for area in areas:
        if admin1_pcode and area["level"] == 2 and area["parent_pcode"] != admin1_pcode:
            continue
        if normalized_search and normalized_search not in _normalize(
            f"{area['name']} {area['pcode']} {area['parent_name']}"
        ):
            continue
        filtered.append(area)
    return filtered


def _legend(areas, indicator):
    values = [
        area["metrics"].get(indicator)
        for area in areas
        if area["metrics"].get(indicator) is not None
    ]
    if not values:
        return {"min": None, "max": None, "available": 0, "missing": len(areas)}
    minimum = min(values)
    maximum = max(values)
    return {
        "min": minimum,
        "max": maximum,
        "available": len(values),
        "missing": len(areas) - len(values),
    }


def get_admin_baseline_payload(
    *, level=2, indicator="population_total", search="", admin1_pcode=None
):
    try:
        level = int(level)
    except (TypeError, ValueError) as exc:
        raise ValueError("level deve ser 1 (província) ou 2 (distrito).") from exc
    if level not in (1, 2):
        raise ValueError("level deve ser 1 (província) ou 2 (distrito).")
    if indicator not in INDICATORS:
        raise ValueError(f"Indicador desconhecido: {indicator}.")

    fixture = load_admin_baseline()
    all_areas = _admin1_areas(fixture["admin2"]) if level == 1 else _admin2_areas(fixture["admin2"])
    areas = _filter_areas(all_areas, search=search, admin1_pcode=admin1_pcode)
    for area in areas:
        area["indicator_value"] = area["metrics"].get(indicator)

    national = _admin1_areas(fixture["admin2"])
    national_metrics = {
        key: _sum_available(area["metrics"].get(key) for area in national)
        for key in INDICATORS
        if not key.endswith("_share") and not key.endswith("_rate")
    }
    national_metrics["female_share"] = _ratio(
        national_metrics["population_female"], national_metrics["population_total"]
    )
    national_metrics["under_18_share"] = _ratio(
        national_metrics["population_under_18"], national_metrics["population_total"]
    )
    national_metrics["dtm_caseload_rate"] = _ratio(
        national_metrics["dtm_caseload"], national_metrics["population_total"]
    )
    national_metrics["pwd_planning_estimate"] = round(
        national_metrics["population_total"] * 0.15, 1
    )

    return {
        "level": level,
        "indicator": indicator,
        "indicator_meta": INDICATORS[indicator],
        "indicators": INDICATORS,
        "areas": areas,
        "legend": _legend(areas, indicator),
        "national_summary": national_metrics,
        "source": fixture["source"],
        "methodology": fixture["methodology"],
        "quality": fixture["quality"],
    }


def get_admin_baseline_tiles(payload):
    """Build a GAUL choropleth while preserving OCHA P-codes in the data API."""
    if not initialize_gee():
        raise RuntimeError("Google Earth Engine não pôde ser inicializado.")

    level = payload["level"]
    gee_level = f"level{level}"
    name_field = GAUL_NAME_FIELD[gee_level]
    gaul_names = _get_admin_names(gee_level, "Mozambique")
    gaul_by_normalized_name = {_normalize(name): name for name in gaul_names}

    values = {}
    unmatched = []
    for area in payload["areas"]:
        value = area["indicator_value"]
        if value is None:
            continue
        gaul_name = gaul_by_normalized_name.get(_normalize(area["name"]))
        if gaul_name is None:
            unmatched.append({"pcode": area["pcode"], "name": area["name"]})
            continue
        values[gaul_name] = float(value)

    if not values:
        raise RuntimeError("Nenhuma área OCHA pôde ser associada à geometria GAUL.")

    try:
        value_dictionary = ee.Dictionary(values)
        collection = (
            ee.FeatureCollection(f"FAO/GAUL/2015/{gee_level}")
            .filter(ee.Filter.eq("ADM0_NAME", "Mozambique"))
            .map(lambda feature: feature.set(
                "baseline_value", value_dictionary.get(feature.get(name_field))
            ))
            .filter(ee.Filter.notNull(["baseline_value"]))
        )
        image = collection.reduceToImage(
            properties=["baseline_value"], reducer=ee.Reducer.first()
        )
        legend = payload["legend"]
        minimum = float(legend["min"])
        maximum = float(legend["max"])
        if minimum == maximum:
            maximum = minimum + 1
        map_id = image.getMapId({
            "min": minimum,
            "max": maximum,
            "palette": payload["indicator_meta"]["palette"],
        })
        return {
            "tile_url": map_id["tile_fetcher"].url_format,
            "dataset": f"FAO/GAUL/2015/{gee_level} + OCHA baseline",
            "matched": len(values),
            "unmatched": unmatched,
        }
    except ee.EEException as exc:
        raise RuntimeError(f"Erro GEE ao criar a camada socioespacial: {exc}") from exc


def estimate_exposed_demographics(exposed_population, pcode=None):
    """Allocate an exposed-population total using OCHA demographic shares."""
    try:
        exposed_population = float(exposed_population)
    except (TypeError, ValueError) as exc:
        raise ValueError("exposed_population deve ser numérico.") from exc
    if exposed_population < 0:
        raise ValueError("exposed_population não pode ser negativo.")

    if pcode:
        level = 1 if len(str(pcode)) == 4 else 2
        payload = get_admin_baseline_payload(
            level=level, indicator="population_total", search=str(pcode)
        )
        area = next((item for item in payload["areas"] if item["pcode"] == pcode), None)
        if area is None:
            raise ValueError(f"P-code não encontrado: {pcode}.")
        metrics = area["metrics"]
        scope = {"level": area["level"], "pcode": area["pcode"], "name": area["name"]}
    else:
        payload = get_admin_baseline_payload(level=1, indicator="population_total")
        metrics = payload["national_summary"]
        scope = {"level": 0, "pcode": "MZ", "name": "Moçambique"}

    total = metrics.get("population_total")
    shares = {
        "female": _ratio(metrics.get("population_female"), total),
        "under_5": _ratio(metrics.get("population_under_5"), total),
        "under_18": _ratio(metrics.get("population_under_18"), total),
        "age_60_plus": _ratio(metrics.get("population_60_plus"), total),
        "pwd_planning_estimate": 15.0,
    }
    estimates = {
        key: round(exposed_population * share / 100) if share is not None else None
        for key, share in shares.items()
    }
    return {
        "scope": scope,
        "exposed_population": round(exposed_population),
        "estimated_groups": estimates,
        "shares_percent": shares,
        "method": "Alocação proporcional pelas estruturas demográficas OCHA 2025.",
        "caveat": (
            "Estimativa de triagem: assume que a população exposta tem a mesma "
            "estrutura demográfica da área; os grupos podem sobrepor-se."
        ),
    }
