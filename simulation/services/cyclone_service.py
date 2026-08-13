from datetime import date

import ee

from georisksim.gee_auth import initialize_gee

from .mozambique_geometry import get_mozambique_geometry


MAX_CYCLONE_INTERVAL_DAYS = 30
CYCLONE_LAYER_TYPES = {"rain", "wind"}


def validate_cyclone_parameters(start_date, end_date, layer_type="rain"):
    """Validate and normalize the parameters used by the cyclone endpoint."""
    if layer_type not in CYCLONE_LAYER_TYPES:
        raise ValueError("type deve ser 'rain' ou 'wind'.")

    try:
        parsed_start = date.fromisoformat(str(start_date))
        parsed_end = date.fromisoformat(str(end_date))
    except (TypeError, ValueError) as exc:
        raise ValueError("start_date e end_date devem usar o formato YYYY-MM-DD.") from exc

    if parsed_end < parsed_start:
        raise ValueError("A data de início deve ser anterior ou igual à data de fim.")

    interval_days = (parsed_end - parsed_start).days + 1
    if interval_days > MAX_CYCLONE_INTERVAL_DAYS:
        raise ValueError(
            f"O intervalo máximo permitido é de {MAX_CYCLONE_INTERVAL_DAYS} dias."
        )

    return parsed_start.isoformat(), parsed_end.isoformat(), layer_type


def get_cyclone_tiles(start_date, end_date, layer_type="rain"):
    """
    Return GEE tiles for cyclone-related environmental conditions.

    Rain is accumulated IMERG precipitation over the selected period. Wind is
    the maximum hourly ERA5-Land 10 m wind speed. Neither layer is a
    reconstructed cyclone track or an observed wind-gust product.
    """
    start_date, end_date, layer_type = validate_cyclone_parameters(
        start_date, end_date, layer_type
    )

    if not initialize_gee():
        raise RuntimeError("Google Earth Engine não pôde ser inicializado.")

    mozambique = get_mozambique_geometry()

    try:
        start = ee.Date(start_date)
        # Earth Engine filterDate excludes the end date.
        end = ee.Date(end_date).advance(1, "day")

        if layer_type == "rain":
            precipitation = (
                ee.ImageCollection("NASA/GPM_L3/IMERG_V07")
                .filterDate(start, end)
                .select("precipitation")
            )

            # IMERG is a half-hourly rate in mm/hour. Each observation therefore
            # contributes rate * 0.5 hours to the period accumulation.
            image = (
                precipitation.sum()
                .multiply(0.5)
                .rename("accumulated_rainfall_mm")
                .clip(mozambique)
            )
            dataset_id = "NASA/GPM_L3/IMERG_V07"
            units = "mm"
            aggregation = "period_sum"
            vis_params = {
                "min": 20,
                "max": 300,
                "palette": [
                    "#e0f3db",
                    "#a8ddb5",
                    "#4eb3d3",
                    "#2b8cbe",
                    "#0868ac",
                    "#084081",
                    "#ffc107",
                    "#ff5722",
                    "#b30000",
                ],
            }
        else:
            wind = ee.ImageCollection("ECMWF/ERA5_LAND/HOURLY").filterDate(start, end)

            def calculate_wind_speed(image):
                u_component = image.select("u_component_of_wind_10m")
                v_component = image.select("v_component_of_wind_10m")
                return (
                    u_component.pow(2)
                    .add(v_component.pow(2))
                    .sqrt()
                    .rename("wind_speed")
                    .copyProperties(image, ["system:time_start"])
                )

            image = (
                wind.map(calculate_wind_speed)
                .max()
                .multiply(3.6)
                .rename("maximum_hourly_wind_speed_kmh")
                .clip(mozambique)
            )
            dataset_id = "ECMWF/ERA5_LAND/HOURLY"
            units = "km/h"
            aggregation = "hourly_maximum"
            vis_params = {
                "min": 50,
                "max": 200,
                "palette": [
                    "#ffffcc",
                    "#ffeda0",
                    "#fed976",
                    "#feb24c",
                    "#fd8d3c",
                    "#fc4e2a",
                    "#e31a1c",
                    "#bd0026",
                    "#800026",
                ],
            }

        map_id = image.getMapId(vis_params)
        return {
            "mapid": map_id["mapid"],
            "token": map_id.get("token", ""),
            "tile_url": map_id["tile_fetcher"].url_format,
            "start_date": start_date,
            "end_date": end_date,
            "type": layer_type,
            "metadata": {
                "country": "Mozambique",
                "dataset": dataset_id,
                "units": units,
                "aggregation": aggregation,
                "disclaimer": (
                    "Indicador ambiental de apoio. Não representa trajetória oficial, "
                    "rajada observada nem categoria do ciclone."
                ),
            },
        }
    except ee.EEException as exc:
        raise RuntimeError(f"Erro ao processar dados de ciclone no GEE: {exc}") from exc
