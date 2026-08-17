"""Global Pasture Watch livestock and grassland dynamics for Mozambique.

The livestock layers are modelled 1 km allocations adjusted to FAOSTAT
national totals. They are suitable for screening and administrative planning,
not for locating individual herds or replacing a livestock census.
"""

from __future__ import annotations

import unicodedata

import ee

from georisksim.gee_auth import initialize_gee

from .admin_baseline_service import get_admin_baseline_payload
from .analysis_projection import ANALYSIS_CRS
from .mozambique_geometry import get_mozambique_geometry


LIVESTOCK_DATASET = (
    "projects/global-pasture-watch/assets/gld-1km/v1/"
    "livestock-headcount-faostat_m"
)
GRASSLAND_DATASET = (
    "projects/global-pasture-watch/assets/ggc-30m/v1/grassland_c"
)
MIN_SUPPORTED_YEAR = 2000
MAX_SUPPORTED_YEAR = 2022
DEFAULT_START_YEAR = 2015
DEFAULT_END_YEAR = MAX_SUPPORTED_YEAR
LIVESTOCK_SCALE_M = 1_000
MAX_REDUCE_PIXELS = 1_000_000_000

SPECIES = {
    "cattle": {"label": "Bovinos", "map_max": 160},
    "buffalo": {"label": "Búfalos", "map_max": 160},
    "goat": {"label": "Caprinos", "map_max": 160},
    "sheep": {"label": "Ovinos", "map_max": 160},
    "horse": {"label": "Equinos", "map_max": 10},
}

MAP_MODES = {
    "headcount": {
        "label": "Efetivo estimado",
        "unit": "animais/célula de 1 km",
    },
    "livestock_change": {
        "label": "Variação do efetivo",
        "unit": "animais/célula de 1 km",
    },
    "pasture_class": {
        "label": "Classe de pastagem",
        "unit": "classe",
    },
    "pasture_change": {
        "label": "Mudança de pastagem",
        "unit": "classe",
    },
    "pasture_pressure": {
        "label": "Pressão sobre pastagens",
        "unit": "animais/km² de pastagem",
    },
}

PASTURE_CLASS_LEGEND = [
    {"value": 1, "label": "Pastagem cultivada", "color": "#ffcd73"},
    {
        "value": 2,
        "label": "Pastagem natural/seminatural",
        "color": "#ff9916",
    },
]

PASTURE_CHANGE_LEGEND = [
    {"value": 1, "label": "Pastagem estável", "color": "#f59e0b"},
    {"value": 2, "label": "Perda de pastagem", "color": "#f43f5e"},
    {"value": 3, "label": "Ganho de pastagem", "color": "#84cc16"},
]


def _normalize(value):
    normalized = unicodedata.normalize("NFKD", str(value or ""))
    return "".join(
        character
        for character in normalized
        if not unicodedata.combining(character)
    ).casefold().strip()


def validate_livestock_dynamics_parameters(
    start_year=DEFAULT_START_YEAR,
    end_year=DEFAULT_END_YEAR,
    species="cattle",
    admin_level=1,
):
    """Validate and normalize public API parameters."""
    try:
        start_year = int(start_year)
        end_year = int(end_year)
        admin_level = int(admin_level)
    except (TypeError, ValueError) as exc:
        raise ValueError(
            "start_year, end_year e admin_level devem ser números inteiros."
        ) from exc

    species = str(species or "").strip().lower()
    if species not in SPECIES:
        supported = ", ".join(SPECIES)
        raise ValueError(f"species inválida. Valores suportados: {supported}.")
    if start_year < MIN_SUPPORTED_YEAR or end_year > MAX_SUPPORTED_YEAR:
        raise ValueError(
            f"O período deve estar entre {MIN_SUPPORTED_YEAR} e "
            f"{MAX_SUPPORTED_YEAR}."
        )
    if start_year >= end_year:
        raise ValueError("start_year deve ser anterior a end_year.")
    if admin_level not in (1, 2):
        raise ValueError("admin_level deve ser 1 (província) ou 2 (distrito).")

    return start_year, end_year, species, admin_level


def get_livestock_dynamics_config():
    """Return UI configuration without requiring an Earth Engine call."""
    admin1 = get_admin_baseline_payload(
        level=1, indicator="population_total"
    )["areas"]
    return {
        "years": {
            "min": MIN_SUPPORTED_YEAR,
            "max": MAX_SUPPORTED_YEAR,
            "default_start": DEFAULT_START_YEAR,
            "default_end": DEFAULT_END_YEAR,
        },
        "species": [
            {"value": value, "label": metadata["label"]}
            for value, metadata in SPECIES.items()
        ],
        "admin_levels": [
            {"value": 1, "label": "Províncias (Admin1)"},
            {"value": 2, "label": "Distritos (Admin2)"},
        ],
        "map_modes": [
            {"value": value, **metadata}
            for value, metadata in MAP_MODES.items()
        ],
        "admin1": [
            {"pcode": area["pcode"], "name": area["name"]}
            for area in admin1
        ],
    }


def _annual_image(dataset, year, band):
    return (
        ee.ImageCollection(dataset)
        .filterDate(f"{year}-01-01", f"{year + 1}-01-01")
        .first()
        .select(band)
    )


def _pasture_area_on_livestock_grid(grassland, target_projection, class_value=None):
    pasture_mask = (
        grassland.eq(class_value)
        if class_value is not None
        else grassland.gt(0)
    )
    return (
        ee.Image.pixelArea()
        .divide(1_000_000)
        .updateMask(pasture_mask)
        .reduceResolution(
            reducer=ee.Reducer.sum(),
            bestEffort=True,
            maxPixels=4096,
        )
        .reproject(target_projection)
        .unmask(0)
    )


def _year_images(year, species, region):
    livestock = (
        _annual_image(LIVESTOCK_DATASET, year, species)
        .rename("livestock")
        .clip(region)
    )
    grassland = (
        _annual_image(GRASSLAND_DATASET, year, "dominant_class")
        .rename("grassland")
        .clip(region)
    )
    projection = livestock.projection()
    return {
        "livestock": livestock,
        "grassland": grassland,
        "pasture_area": _pasture_area_on_livestock_grid(
            grassland, projection
        ).rename("pasture_area_km2"),
        "cultivated_area": _pasture_area_on_livestock_grid(
            grassland, projection, class_value=1
        ).rename("cultivated_area_km2"),
        "natural_area": _pasture_area_on_livestock_grid(
            grassland, projection, class_value=2
        ).rename("natural_area_km2"),
    }


def _reduce_sum(image, region):
    return image.reduceRegion(
        reducer=ee.Reducer.sum(),
        geometry=region,
        crs=ANALYSIS_CRS,
        scale=LIVESTOCK_SCALE_M,
        maxPixels=MAX_REDUCE_PIXELS,
        tileScale=8,
    )


def _baseline_indexes(level):
    areas = get_admin_baseline_payload(
        level=level, indicator="population_total"
    )["areas"]
    exact = {}
    by_name = {}
    for area in areas:
        key = (_normalize(area.get("parent_name")), _normalize(area["name"]))
        exact[key] = area
        by_name.setdefault(_normalize(area["name"]), []).append(area)
    return exact, by_name


def _join_human_context(rows, level):
    exact, by_name = _baseline_indexes(level)
    joined = []
    for row in rows:
        key = (_normalize(row.get("parent_name")), _normalize(row["name"]))
        baseline = exact.get(key)
        if baseline is None:
            candidates = by_name.get(_normalize(row["name"]), [])
            baseline = candidates[0] if len(candidates) == 1 else None

        metrics = (baseline or {}).get("metrics", {})
        population = metrics.get("population_total")
        end_value = row.get("livestock_end") or 0
        row.update(
            {
                "pcode": (baseline or {}).get("pcode"),
                "population_total": population,
                "dtm_caseload": metrics.get("dtm_caseload"),
                "animals_per_100_people": (
                    round((end_value / population) * 100, 2)
                    if population
                    else None
                ),
                "human_context_match": baseline is not None,
            }
        )
        joined.append(row)
    return joined


def _format_number(value, digits=2):
    return round(float(value or 0), digits)


def _format_admin_rows(raw_rows, admin_level, national_end):
    rows = []
    for item in raw_rows or []:
        start_value = float(item.get("livestock_start", 0) or 0)
        end_value = float(item.get("livestock_end", 0) or 0)
        pasture_area = float(item.get("pasture_end_km2", 0) or 0)
        change = end_value - start_value
        rows.append(
            {
                "level": admin_level,
                "name": item.get("name"),
                "parent_name": item.get("parent_name"),
                "livestock_start": round(start_value, 2),
                "livestock_end": round(end_value, 2),
                "change": round(change, 2),
                "change_pct": (
                    round((change / start_value) * 100, 2)
                    if start_value
                    else None
                ),
                "pasture_end_km2": round(pasture_area, 2),
                "pasture_pressure": (
                    round(end_value / pasture_area, 2)
                    if pasture_area
                    else None
                ),
                "share_national_pct": (
                    round((end_value / national_end) * 100, 2)
                    if national_end
                    else None
                ),
            }
        )

    rows = _join_human_context(rows, admin_level)
    return sorted(rows, key=lambda item: item["livestock_end"], reverse=True)


def _tile_payload(image, vis_params, *, label, unit, legend=None):
    map_id = image.getMapId(vis_params)
    return {
        "mapid": map_id["mapid"],
        "token": map_id.get("token", ""),
        "tile_url": map_id["tile_fetcher"].url_format,
        "label": label,
        "unit": unit,
        "legend": legend or [],
    }


def _build_map_layers(start_images, end_images, species_metadata, region):
    start_livestock = start_images["livestock"]
    end_livestock = end_images["livestock"]
    livestock_change = end_livestock.subtract(start_livestock)

    start_pasture = start_images["grassland"].gt(0)
    end_pasture = end_images["grassland"].gt(0)
    stable = start_pasture.And(end_pasture)
    loss = start_pasture.And(end_pasture.Not())
    gain = start_pasture.Not().And(end_pasture)
    pasture_change = (
        ee.Image(0)
        .where(stable, 1)
        .where(loss, 2)
        .where(gain, 3)
        .updateMask(stable.Or(loss).Or(gain))
        .clip(region)
    )

    pasture_area = end_images["pasture_area"]
    pasture_pressure = (
        end_livestock.divide(pasture_area)
        .updateMask(pasture_area.gt(0.05))
        .rename("pasture_pressure")
    )
    map_max = species_metadata["map_max"]
    change_max = max(map_max / 2, 5)

    return {
        "headcount": _tile_payload(
            end_livestock.updateMask(end_livestock.gt(0)),
            {
                "min": 0,
                "max": map_max,
                "palette": [
                    "#fff7bc", "#fec44f", "#fe9929", "#d95f0e", "#7f2704"
                ],
            },
            label=MAP_MODES["headcount"]["label"],
            unit=MAP_MODES["headcount"]["unit"],
        ),
        "livestock_change": _tile_payload(
            livestock_change.updateMask(livestock_change.abs().gte(0.1)),
            {
                "min": -change_max,
                "max": change_max,
                "palette": ["#be123c", "#fb7185", "#f8fafc", "#67e8f9", "#0369a1"],
            },
            label=MAP_MODES["livestock_change"]["label"],
            unit=MAP_MODES["livestock_change"]["unit"],
        ),
        "pasture_class": _tile_payload(
            end_images["grassland"].selfMask(),
            {
                "min": 1,
                "max": 2,
                "palette": [item["color"] for item in PASTURE_CLASS_LEGEND],
            },
            label=MAP_MODES["pasture_class"]["label"],
            unit=MAP_MODES["pasture_class"]["unit"],
            legend=PASTURE_CLASS_LEGEND,
        ),
        "pasture_change": _tile_payload(
            pasture_change,
            {
                "min": 1,
                "max": 3,
                "palette": [item["color"] for item in PASTURE_CHANGE_LEGEND],
            },
            label=MAP_MODES["pasture_change"]["label"],
            unit=MAP_MODES["pasture_change"]["unit"],
            legend=PASTURE_CHANGE_LEGEND,
        ),
        "pasture_pressure": _tile_payload(
            pasture_pressure,
            {
                "min": 0,
                "max": 250,
                "palette": ["#ecfccb", "#a3e635", "#facc15", "#f97316", "#b91c1c"],
            },
            label=MAP_MODES["pasture_pressure"]["label"],
            unit=MAP_MODES["pasture_pressure"]["unit"],
        ),
    }


def get_livestock_dynamics(
    start_year=DEFAULT_START_YEAR,
    end_year=DEFAULT_END_YEAR,
    species="cattle",
    admin_level=1,
):
    """Return map layers, national series and Admin1/Admin2 summaries."""
    start_year, end_year, species, admin_level = (
        validate_livestock_dynamics_parameters(
            start_year, end_year, species, admin_level
        )
    )
    if not initialize_gee():
        raise RuntimeError("Google Earth Engine não pôde ser inicializado.")

    region = get_mozambique_geometry()
    species_metadata = SPECIES[species]

    try:
        annual = {
            year: _year_images(year, species, region)
            for year in range(start_year, end_year + 1)
        }
        start_images = annual[start_year]
        end_images = annual[end_year]

        series_bands = []
        for year, images in annual.items():
            series_bands.extend(
                [
                    images["livestock"].rename(f"livestock_{year}"),
                    images["pasture_area"].rename(f"pasture_{year}"),
                ]
            )

        summary_bands = ee.Image.cat(
            start_images["livestock"].rename("livestock_start"),
            end_images["livestock"].rename("livestock_end"),
            start_images["pasture_area"].rename("pasture_start_km2"),
            end_images["pasture_area"].rename("pasture_end_km2"),
            end_images["cultivated_area"].rename("cultivated_end_km2"),
            end_images["natural_area"].rename("natural_end_km2"),
        )

        admin_collection = (
            ee.FeatureCollection(f"FAO/GAUL/2015/level{admin_level}")
            .filter(ee.Filter.eq("ADM0_NAME", "Mozambique"))
        )
        name_field = f"ADM{admin_level}_NAME"

        admin_reductions = summary_bands.reduceRegions(
            collection=admin_collection,
            reducer=ee.Reducer.sum(),
            crs=ANALYSIS_CRS,
            scale=LIVESTOCK_SCALE_M,
            tileScale=8,
            maxPixelsPerRegion=MAX_REDUCE_PIXELS,
        )

        def summarize_admin(feature):
            return feature.set(
                "simgeo_summary",
                ee.Dictionary(
                    {
                        "name": feature.get(name_field),
                        "parent_name": (
                            feature.get("ADM1_NAME")
                            if admin_level == 2
                            else "Mozambique"
                        ),
                        "livestock_start": feature.get("livestock_start"),
                        "livestock_end": feature.get("livestock_end"),
                        "pasture_end_km2": feature.get("pasture_end_km2"),
                    }
                ),
            )

        computed = ee.Dictionary(
            {
                "series": _reduce_sum(ee.Image.cat(*series_bands), region),
                "summary": _reduce_sum(summary_bands, region),
                "admin": admin_reductions.map(summarize_admin).aggregate_array(
                    "simgeo_summary"
                ),
            }
        ).getInfo()

        series_values = computed.get("series") or {}
        timeseries = []
        previous = None
        for year in range(start_year, end_year + 1):
            livestock_value = _format_number(
                series_values.get(f"livestock_{year}")
            )
            pasture_value = _format_number(
                series_values.get(f"pasture_{year}")
            )
            timeseries.append(
                {
                    "year": year,
                    "livestock": livestock_value,
                    "pasture_km2": pasture_value,
                    "pasture_pressure": (
                        round(livestock_value / pasture_value, 2)
                        if pasture_value
                        else None
                    ),
                    "annual_change": (
                        None
                        if previous is None
                        else round(livestock_value - previous, 2)
                    ),
                }
            )
            previous = livestock_value

        summary = computed.get("summary") or {}
        livestock_start = float(summary.get("livestock_start", 0) or 0)
        livestock_end = float(summary.get("livestock_end", 0) or 0)
        pasture_start = float(summary.get("pasture_start_km2", 0) or 0)
        pasture_end = float(summary.get("pasture_end_km2", 0) or 0)
        livestock_change = livestock_end - livestock_start
        pasture_change = pasture_end - pasture_start

        admin_rows = _format_admin_rows(
            computed.get("admin") or [], admin_level, livestock_end
        )
        layers = _build_map_layers(
            start_images, end_images, species_metadata, region
        )

        return {
            "gee_layer": layers["headcount"],
            "gee_layers": layers,
            "stats": {
                "livestock_start": round(livestock_start, 2),
                "livestock_end": round(livestock_end, 2),
                "livestock_change": round(livestock_change, 2),
                "livestock_change_pct": (
                    round((livestock_change / livestock_start) * 100, 2)
                    if livestock_start
                    else None
                ),
                "pasture_start_km2": round(pasture_start, 2),
                "pasture_end_km2": round(pasture_end, 2),
                "pasture_change_km2": round(pasture_change, 2),
                "pasture_change_pct": (
                    round((pasture_change / pasture_start) * 100, 2)
                    if pasture_start
                    else None
                ),
                "cultivated_end_km2": _format_number(
                    summary.get("cultivated_end_km2")
                ),
                "natural_end_km2": _format_number(
                    summary.get("natural_end_km2")
                ),
                "pasture_pressure_start": (
                    round(livestock_start / pasture_start, 2)
                    if pasture_start
                    else None
                ),
                "pasture_pressure_end": (
                    round(livestock_end / pasture_end, 2)
                    if pasture_end
                    else None
                ),
            },
            "timeseries": timeseries,
            "admin_summary": admin_rows,
            "metadata": {
                "country": "Mozambique",
                "start_year": start_year,
                "end_year": end_year,
                "species": species,
                "species_label": species_metadata["label"],
                "admin_level": admin_level,
                "livestock_dataset": LIVESTOCK_DATASET,
                "grassland_dataset": GRASSLAND_DATASET,
                "livestock_resolution_m": LIVESTOCK_SCALE_M,
                "grassland_resolution_m": 30,
                "analysis_scale_m": LIVESTOCK_SCALE_M,
                "analysis_crs": ANALYSIS_CRS,
                "license": "CC BY 4.0",
                "attribution": "Global Pasture Watch / Land & Carbon Lab",
                "human_context_source": (
                    "OCHA Mozambique Baseline Data 2025 HNO; correspondência "
                    "normalizada por nomes Admin1/Admin2."
                ),
                "disclaimer": (
                    "O efetivo pecuário é uma alocação modelada a 1 km, ajustada "
                    "aos totais nacionais FAOSTAT; não representa rebanhos "
                    "observados nem substitui o censo pecuário. O Global Pasture "
                    "Watch documenta subestimação parcial de pastagens em "
                    "Moçambique. Mudanças anuais e resultados Admin2 devem ser "
                    "interpretados como estimativas de triagem e validados localmente."
                ),
            },
        }
    except ee.EEException as exc:
        raise RuntimeError(
            "Erro ao processar a dinâmica pecuária no Google Earth Engine: "
            f"{exc}"
        ) from exc
