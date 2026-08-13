from datetime import date

import ee

from georisksim.gee_auth import initialize_gee

from .mozambique_geometry import get_mozambique_geometry


FLOOD_ENGINES = {"glofas", "sentinel1"}
GLOFAS_RETURN_PERIODS = {10, 20, 50, 75, 100, 200, 500}
MAX_SENTINEL1_INTERVAL_DAYS = 30
FLOOD_DEPTH_THRESHOLD_M = 0.15
EXPOSURE_SCALE_M = 100


def validate_flood_impact_parameters(
    engine="glofas", return_period=100, s1_start=None, s1_end=None
):
    """Validate and normalize flood-impact request parameters."""
    if engine not in FLOOD_ENGINES:
        raise ValueError("engine deve ser 'glofas' ou 'sentinel1'.")

    if engine == "glofas":
        try:
            return_period = int(return_period)
        except (TypeError, ValueError) as exc:
            raise ValueError("return_period deve ser um número inteiro.") from exc

        if return_period not in GLOFAS_RETURN_PERIODS:
            supported = ", ".join(str(value) for value in sorted(GLOFAS_RETURN_PERIODS))
            raise ValueError(f"return_period inválido. Valores suportados: {supported}.")
        return engine, return_period, None, None

    if not s1_start or not s1_end:
        raise ValueError("s1_start e s1_end são obrigatórios para Sentinel-1.")

    try:
        parsed_start = date.fromisoformat(str(s1_start))
        parsed_end = date.fromisoformat(str(s1_end))
    except (TypeError, ValueError) as exc:
        raise ValueError("s1_start e s1_end devem usar o formato YYYY-MM-DD.") from exc

    if parsed_end < parsed_start:
        raise ValueError("s1_start deve ser anterior ou igual a s1_end.")

    interval_days = (parsed_end - parsed_start).days + 1
    if interval_days > MAX_SENTINEL1_INTERVAL_DAYS:
        raise ValueError(
            f"O intervalo Sentinel-1 não pode exceder "
            f"{MAX_SENTINEL1_INTERVAL_DAYS} dias."
        )

    return engine, None, parsed_start.isoformat(), parsed_end.isoformat()


def _glofas_flood_mask(mozambique, return_period):
    collection = ee.ImageCollection(
        "JRC/CEMS_GLOFAS/FloodHazard/v2_1"
    ).filterBounds(mozambique)
    depth_band = f"RP{return_period}_depth"
    depth = collection.select(depth_band).mosaic().rename("flood_depth_m")
    permanent_water = (
        collection.select("permanent_water_class").mosaic().unmask(0).eq(1)
    )
    return depth.gt(FLOOD_DEPTH_THRESHOLD_M).And(
        permanent_water.Not()
    ).rename("flooded")


def _sentinel1_flood_mask(mozambique, start_date, end_date):
    pre_start = ee.Date(start_date).advance(-1, "month")
    pre_end = ee.Date(start_date)
    post_start = ee.Date(start_date)
    post_end = ee.Date(end_date).advance(1, "day")

    sentinel1 = (
        ee.ImageCollection("COPERNICUS/S1_GRD")
        .filterBounds(mozambique)
        .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VH"))
        .filter(ee.Filter.eq("instrumentMode", "IW"))
        .filter(ee.Filter.eq("resolution_meters", 10))
        .select("VH")
    )

    pre_event = sentinel1.filterDate(pre_start, pre_end).median().focal_median(
        50, "circle", "meters"
    )
    post_event = sentinel1.filterDate(post_start, post_end).median().focal_median(
        50, "circle", "meters"
    )

    # Screening thresholds: newly dark radar returns after the event. These
    # thresholds need local validation before operational use.
    return post_event.lt(-18).And(pre_event.gt(-16)).rename("flooded")


def get_flood_impact(
    engine="glofas", return_period=100, s1_start=None, s1_end=None
):
    """Return a flood-hazard tile and first-order exposure estimates."""
    engine, return_period, s1_start, s1_end = validate_flood_impact_parameters(
        engine, return_period, s1_start, s1_end
    )

    if not initialize_gee():
        raise RuntimeError("Google Earth Engine não pôde ser inicializado.")

    mozambique = get_mozambique_geometry()

    try:
        if engine == "glofas":
            flood_mask = _glofas_flood_mask(mozambique, return_period)
            hazard_dataset = "JRC/CEMS_GLOFAS/FloodHazard/v2_1"
        else:
            flood_mask = _sentinel1_flood_mask(mozambique, s1_start, s1_end)
            hazard_dataset = "COPERNICUS/S1_GRD"

        flood_mask = flood_mask.clip(mozambique)

        population = (
            ee.ImageCollection("WorldPop/GP/100m/pop")
            .filter(ee.Filter.eq("country", "MOZ"))
            .filter(ee.Filter.eq("year", 2020))
            .mosaic()
            .select("population")
            .clip(mozambique)
        )
        landcover = (
            ee.ImageCollection("ESA/WorldCover/v100")
            .first()
            .select("Map")
            .clip(mozambique)
        )
        cropland = landcover.eq(40)

        exposed_population = population.updateMask(flood_mask).rename("population")
        exposed_cropland = (
            ee.Image.pixelArea()
            .updateMask(cropland.And(flood_mask))
            .rename("cropland_area_m2")
        )

        exposure = ee.Image.cat(
            [exposed_population, exposed_cropland]
        ).reduceRegion(
            reducer=ee.Reducer.sum(),
            geometry=mozambique,
            scale=EXPOSURE_SCALE_M,
            maxPixels=1e9,
            tileScale=4,
        )
        exposure_values = exposure.getInfo() or {}
        total_population = exposure_values.get("population", 0) or 0
        total_cropland_ha = (
            exposure_values.get("cropland_area_m2", 0) or 0
        ) / 10_000

        map_id = flood_mask.selfMask().getMapId(
            {"min": 1, "max": 1, "palette": ["#00ffff"]}
        )

        return {
            "gee_layer": {
                "mapid": map_id["mapid"],
                "token": map_id.get("token", ""),
                "tile_url": map_id["tile_fetcher"].url_format,
            },
            "stats": {
                "exposed_population": round(total_population),
                "exposed_agriculture_ha": round(total_cropland_ha, 2),
            },
            "metadata": {
                "country": "Mozambique",
                "engine": engine,
                "return_period": return_period,
                "event_start": s1_start,
                "event_end": s1_end,
                "hazard_dataset": hazard_dataset,
                "population_dataset": "WorldPop/GP/100m/pop (2020, MOZ)",
                "landcover_dataset": "ESA/WorldCover/v100 (2020)",
                "exposure_scale_m": EXPOSURE_SCALE_M,
                "flood_depth_threshold_m": (
                    FLOOD_DEPTH_THRESHOLD_M if engine == "glofas" else None
                ),
                "disclaimer": (
                    "Estimativa de triagem baseada em hazard e exposição. "
                    "Não substitui modelação hidráulica local nem avaliação de campo."
                ),
            },
        }
    except ee.EEException as exc:
        raise RuntimeError(
            f"Erro ao processar impacto da cheia no GEE: {exc}"
        ) from exc
