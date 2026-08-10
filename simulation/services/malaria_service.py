"""Google Earth Engine service for environmental malaria suitability.

The resulting index describes environmental receptivity for mosquito survival
and breeding. It is not an estimate of malaria incidence, prevalence, or burden.
"""

from datetime import date

import ee

from georisksim.gee_auth import initialize_gee


DEFAULT_START_YEAR = 2020
DEFAULT_END_YEAR = 2025
DEFAULT_MONTH = 0
MIN_SUPPORTED_YEAR = 2001

MALARIA_WEIGHTS = {
    "temperature": 0.30,
    "rainfall": 0.25,
    "surface_water": 0.20,
    "vegetation": 0.15,
    "elevation": 0.10,
}

MALARIA_DATASETS = {
    "temperature": "MODIS/061/MOD11A2",
    "rainfall": "UCSB-CHG/CHIRPS/DAILY",
    "surface_water": "JRC/GSW1_4/GlobalSurfaceWater",
    "vegetation": "MODIS/061/MOD13Q1",
    "elevation": "USGS/SRTMGL1_003",
}

MALARIA_PALETTE = ["1a9850", "91cf60", "fee08b", "fc8d59", "d73027"]
MALARIA_LEGEND = [
    {"label": "Muito baixa", "min": 0.0, "max": 0.2, "color": "#1a9850"},
    {"label": "Baixa", "min": 0.2, "max": 0.4, "color": "#91cf60"},
    {"label": "Moderada", "min": 0.4, "max": 0.6, "color": "#fee08b"},
    {"label": "Alta", "min": 0.6, "max": 0.8, "color": "#fc8d59"},
    {"label": "Muito alta", "min": 0.8, "max": 1.0, "color": "#d73027"},
]


def validate_malaria_parameters(start_year, end_year, month=DEFAULT_MONTH):
    """Validate and normalize public API parameters."""
    start_year = int(start_year)
    end_year = int(end_year)
    month = int(month)
    max_supported_year = date.today().year - 1

    if start_year < MIN_SUPPORTED_YEAR:
        raise ValueError(
            f"start_year deve ser igual ou posterior a {MIN_SUPPORTED_YEAR}."
        )
    if end_year > max_supported_year:
        raise ValueError(
            f"end_year não pode ser posterior a {max_supported_year}."
        )
    if start_year > end_year:
        raise ValueError("start_year não pode ser posterior a end_year.")
    if month < 0 or month > 12:
        raise ValueError("month deve estar entre 0 (anual) e 12.")

    return start_year, end_year, month


def _mozambique_geometry():
    return (
        ee.FeatureCollection("USDOS/LSIB_SIMPLE/2017")
        .filter(ee.Filter.eq("country_na", "Mozambique"))
        .geometry()
    )


def _filter_period(collection, start_year, end_year, month):
    filtered = collection.filterDate(
        ee.Date.fromYMD(start_year, 1, 1),
        ee.Date.fromYMD(end_year + 1, 1, 1),
    )
    if month:
        filtered = filtered.filter(ee.Filter.calendarRange(month, month, "month"))
    return filtered


def _mean_surface_temperature(start_year, end_year, month):
    def mask_quality(image):
        good_day = image.select("QC_Day").bitwiseAnd(3).lte(1)
        good_night = image.select("QC_Night").bitwiseAnd(3).lte(1)
        day = image.select("LST_Day_1km")
        night = image.select("LST_Night_1km")
        return day.add(night).divide(2).updateMask(good_day.And(good_night))

    collection = _filter_period(
        ee.ImageCollection(MALARIA_DATASETS["temperature"]),
        start_year,
        end_year,
        month,
    )
    return (
        collection.map(mask_quality)
        .mean()
        .multiply(0.02)
        .subtract(273.15)
        .rename("temperature_c")
    )


def _mean_period_rainfall(start_year, end_year, month):
    daily = ee.ImageCollection(MALARIA_DATASETS["rainfall"]).select("precipitation")
    years = ee.List.sequence(start_year, end_year)

    def period_total(year):
        year = ee.Number(year)
        if month:
            period_start = ee.Date.fromYMD(year, month, 1)
            period_end = period_start.advance(1, "month")
        else:
            period_start = ee.Date.fromYMD(year, 1, 1)
            period_end = period_start.advance(1, "year")

        return (
            daily.filterDate(period_start, period_end)
            .sum()
            .rename("rainfall_mm")
            .set("year", year)
        )

    return ee.ImageCollection.fromImages(years.map(period_total)).mean()


def _mean_ndvi(start_year, end_year, month):
    def mask_quality(image):
        good_quality = image.select("SummaryQA").lte(1)
        return image.select("NDVI").updateMask(good_quality)

    collection = _filter_period(
        ee.ImageCollection(MALARIA_DATASETS["vegetation"]),
        start_year,
        end_year,
        month,
    )
    return collection.map(mask_quality).mean().multiply(0.0001).rename("ndvi")


def _temperature_score(temperature_c):
    # Suitability rises from 18-22 C, remains high from 22-30 C, and
    # declines from 30-34 C instead of assuming a linear relationship.
    lower = temperature_c.subtract(18).divide(4).clamp(0, 1)
    upper = ee.Image.constant(34).subtract(temperature_c).divide(4).clamp(0, 1)
    return lower.min(upper).rename("temperature_score")


def _rainfall_score(rainfall_mm, month):
    # Monthly totals use a trapezoidal response. Annual totals are converted to
    # a monthly equivalent so both products retain the same response function.
    comparable_rainfall = rainfall_mm.divide(12) if month == 0 else rainfall_mm
    lower = comparable_rainfall.subtract(20).divide(60).clamp(0, 1)
    upper = ee.Image.constant(500).subtract(comparable_rainfall).divide(250).clamp(0, 1)
    return lower.min(upper).rename("rainfall_score")


def _surface_water_score():
    return (
        ee.Image(MALARIA_DATASETS["surface_water"])
        .select("occurrence")
        .unmask(0)
        .divide(100)
        .clamp(0, 1)
        .rename("surface_water_score")
    )


def _vegetation_score(ndvi):
    return ndvi.subtract(0.15).divide(0.35).clamp(0, 1).rename("vegetation_score")


def _elevation_score():
    elevation = ee.Image(MALARIA_DATASETS["elevation"]).select("elevation")
    return (
        ee.Image.constant(1500)
        .subtract(elevation)
        .divide(1500)
        .clamp(0, 1)
        .rename("elevation_score")
    )


def get_malaria_suitability_tiles(
    start_year=DEFAULT_START_YEAR,
    end_year=DEFAULT_END_YEAR,
    month=DEFAULT_MONTH,
):
    """Return map tiles for Mozambique's environmental malaria suitability."""
    start_year, end_year, month = validate_malaria_parameters(
        start_year, end_year, month
    )

    if not initialize_gee():
        raise RuntimeError("Google Earth Engine não pôde ser inicializado.")

    try:
        region = _mozambique_geometry()
        temperature = _mean_surface_temperature(start_year, end_year, month)
        rainfall = _mean_period_rainfall(start_year, end_year, month)
        ndvi = _mean_ndvi(start_year, end_year, month)

        components = {
            "temperature": _temperature_score(temperature),
            "rainfall": _rainfall_score(rainfall, month),
            "surface_water": _surface_water_score(),
            "vegetation": _vegetation_score(ndvi),
            "elevation": _elevation_score(),
        }

        component_names = list(MALARIA_WEIGHTS)
        first_component = component_names[0]
        suitability = components[first_component].multiply(
            MALARIA_WEIGHTS[first_component]
        )
        for component in component_names[1:]:
            suitability = suitability.add(
                components[component].multiply(MALARIA_WEIGHTS[component])
            )

        suitability = suitability.clamp(0, 1).rename("malaria_suitability").clip(region)
        map_id = suitability.getMapId(
            {"min": 0, "max": 1, "palette": MALARIA_PALETTE}
        )

        return {
            "mapid": map_id["mapid"],
            "token": map_id.get("token", ""),
            "tile_url": map_id["tile_fetcher"].url_format,
            "metadata": {
                "country": "Mozambique",
                "index": "Environmental Malaria Suitability Index",
                "start_year": start_year,
                "end_year": end_year,
                "month": month,
                "temporal_resolution": "annual" if month == 0 else "monthly climatology",
                "effective_input_scale_m": 5566,
                "weights": MALARIA_WEIGHTS,
                "datasets": MALARIA_DATASETS,
                "legend": MALARIA_LEGEND,
                "disclaimer": (
                    "Este índice representa apenas aptidão ambiental. Não representa "
                    "casos, incidência, prevalência ou carga de malária."
                ),
            },
        }
    except Exception as exc:
        raise RuntimeError(f"Erro ao processar a aptidão ambiental da malária: {exc}") from exc
