"""Google Earth Engine service for annual forest-cover dynamics.

The module uses annual mode composites from Dynamic World. The ``trees``
class is treated as tree cover and therefore can include natural forest,
secondary forest and plantations. Results are screening estimates rather than
an official deforestation inventory.
"""

from datetime import date

import ee

from georisksim.gee_auth import initialize_gee

from .equal_area_projection import EQUAL_AREA_CRS_CODE, EQUAL_AREA_CRS_WKT
from .mozambique_geometry import get_mozambique_geometry


DYNAMIC_WORLD_DATASET = "GOOGLE/DYNAMICWORLD/V1"
GAUL_LEVEL1_DATASET = "FAO/GAUL/2015/level1"
DEFAULT_START_YEAR = 2016
DEFAULT_END_YEAR = date.today().year - 1
MIN_SUPPORTED_YEAR = 2016
MAX_ANALYSIS_YEARS = 10
TREE_CLASS = 1
MIN_ANNUAL_OBSERVATIONS = 3
COUNTRY_ANALYSIS_SCALE_M = 250
PROVINCE_ANALYSIS_SCALE_M = 100
CUSTOM_ANALYSIS_SCALE_M = 30
ANALYSIS_CRS = EQUAL_AREA_CRS_CODE
MAX_CUSTOM_GEOMETRY_VERTICES = 20_000

CLASS_NAMES = {
    0: "Água",
    1: "Árvores",
    2: "Vegetação herbácea",
    3: "Vegetação inundada",
    4: "Agricultura",
    5: "Arbustos",
    6: "Área construída",
    7: "Solo exposto",
    8: "Neve e gelo",
}

CHANGE_LEGEND = [
    {"value": 1, "label": "Floresta estável", "color": "#0f766e"},
    {"value": 2, "label": "Perda de floresta", "color": "#fb7185"},
    {"value": 3, "label": "Ganho de floresta", "color": "#a3e635"},
]


def validate_forest_dynamics_parameters(
    start_year=DEFAULT_START_YEAR,
    end_year=DEFAULT_END_YEAR,
    scope="country",
    area_name=None,
    geometry=None,
):
    """Validate and normalize public API parameters."""
    try:
        start_year = int(start_year)
        end_year = int(end_year)
    except (TypeError, ValueError) as exc:
        raise ValueError("start_year e end_year devem ser números inteiros.") from exc

    max_supported_year = date.today().year - 1
    if start_year < MIN_SUPPORTED_YEAR:
        raise ValueError(
            f"start_year deve ser igual ou posterior a {MIN_SUPPORTED_YEAR}."
        )
    if end_year > max_supported_year:
        raise ValueError(
            f"end_year não pode ser posterior a {max_supported_year}."
        )
    if start_year >= end_year:
        raise ValueError("start_year deve ser anterior a end_year.")
    if end_year - start_year + 1 > MAX_ANALYSIS_YEARS:
        raise ValueError(
            f"O período não pode exceder {MAX_ANALYSIS_YEARS} anos completos."
        )

    scope = str(scope or "country").strip().lower()
    if scope not in {"country", "province", "custom"}:
        raise ValueError("scope deve ser 'country', 'province' ou 'custom'.")

    normalized_area_name = str(area_name or "").strip() or None
    if scope == "province" and not normalized_area_name:
        raise ValueError("area_name é obrigatório quando scope='province'.")
    if scope == "custom" and not geometry:
        raise ValueError("geometry é obrigatório quando scope='custom'.")

    return start_year, end_year, scope, normalized_area_name


def _province_collection():
    return ee.FeatureCollection(GAUL_LEVEL1_DATASET).filter(
        ee.Filter.eq("ADM0_NAME", "Mozambique")
    )


def _count_positions(value):
    if not isinstance(value, list):
        return 0
    if len(value) >= 2 and all(
        isinstance(item, (int, float)) for item in value[:2]
    ):
        return 1
    return sum(_count_positions(item) for item in value)


def _normalize_custom_geometries(payload):
    if not isinstance(payload, dict):
        raise ValueError("geometry deve ser um objeto GeoJSON válido.")

    geojson_type = payload.get("type")
    if geojson_type == "Feature":
        geometries = [payload.get("geometry")]
    elif geojson_type == "FeatureCollection":
        features = payload.get("features") or []
        geometries = [
            feature.get("geometry")
            for feature in features
            if isinstance(feature, dict) and feature.get("geometry")
        ]
    elif geojson_type in {"Polygon", "MultiPolygon"}:
        geometries = [payload]
    else:
        raise ValueError(
            "O GeoJSON deve ser Polygon, MultiPolygon, Feature ou FeatureCollection."
        )

    if not geometries or any(
        not isinstance(geometry, dict)
        or geometry.get("type") not in {"Polygon", "MultiPolygon"}
        for geometry in geometries
    ):
        raise ValueError("O GeoJSON não contém polígonos válidos.")

    vertex_count = sum(
        _count_positions(geometry.get("coordinates"))
        for geometry in geometries
        if isinstance(geometry, dict)
    )
    if vertex_count < 4:
        raise ValueError("O GeoJSON não contém coordenadas poligonais válidas.")
    if vertex_count > MAX_CUSTOM_GEOMETRY_VERTICES:
        raise ValueError(
            "A geometria é demasiado complexa. Simplifique o GeoJSON para "
            f"menos de {MAX_CUSTOM_GEOMETRY_VERTICES} vértices."
        )

    return geometries


def _analysis_region(scope, area_name, custom_geometries=None):
    if scope == "country":
        return get_mozambique_geometry(), "Moçambique", COUNTRY_ANALYSIS_SCALE_M

    if scope == "custom":
        features = [
            ee.Feature(ee.Geometry(geometry))
            for geometry in custom_geometries or []
        ]
        custom_region = ee.FeatureCollection(features).geometry().intersection(
            get_mozambique_geometry(), ee.ErrorMargin(1)
        )
        if not custom_region.area(1).gt(0).getInfo():
            raise ValueError(
                "A geometria personalizada não intersecta Moçambique."
            )
        return (
            custom_region,
            area_name or "Área personalizada",
            CUSTOM_ANALYSIS_SCALE_M,
        )

    province = _province_collection().filter(
        ee.Filter.eq("ADM1_NAME", area_name)
    )
    return province.geometry(), area_name, PROVINCE_ANALYSIS_SCALE_M


def _annual_landcover(region, year):
    collection = (
        ee.ImageCollection(DYNAMIC_WORLD_DATASET)
        .filterBounds(region)
        .filterDate(f"{year}-01-01", f"{year + 1}-01-01")
    )
    labels = collection.select("label")
    valid_observations = labels.count().gte(MIN_ANNUAL_OBSERVATIONS)
    return (
        labels.reduce(ee.Reducer.mode())
        .rename("label")
        .updateMask(valid_observations)
        .clip(region)
    )


def _area_band(mask, name):
    return (
        ee.Image.pixelArea()
        .divide(10_000)
        .updateMask(mask)
        .rename(name)
    )


def _reduce_area_bands(image, region, scale):
    return image.reduceRegion(
        reducer=ee.Reducer.sum(),
        geometry=region,
        crs=EQUAL_AREA_CRS_WKT,
        scale=scale,
        maxPixels=1e9,
        tileScale=16,
    )


def _transition_areas(mask, class_image, region, scale):
    area_and_class = ee.Image.cat(
        _area_band(mask, "area_ha"),
        class_image.rename("class"),
    ).updateMask(mask)
    return area_and_class.reduceRegion(
        reducer=ee.Reducer.sum().group(groupField=1, groupName="class"),
        geometry=region,
        crs=EQUAL_AREA_CRS_WKT,
        scale=scale,
        maxPixels=1e9,
        tileScale=16,
    )


def _format_transition_groups(groups):
    transitions = []
    for group in groups or []:
        class_value = int(group.get("class"))
        transitions.append(
            {
                "class_value": class_value,
                "class_name": CLASS_NAMES.get(class_value, f"Classe {class_value}"),
                "area_ha": round(float(group.get("sum", 0) or 0), 2),
            }
        )
    return sorted(transitions, key=lambda item: item["area_ha"], reverse=True)


def get_forest_area_options(scope="province"):
    """Return available administrative areas for the forest module."""
    scope = str(scope or "province").strip().lower()
    if scope != "province":
        raise ValueError("Apenas scope='province' é suportado nesta lista.")

    if not initialize_gee():
        raise RuntimeError("Google Earth Engine não pôde ser inicializado.")

    try:
        names = (
            _province_collection()
            .aggregate_array("ADM1_NAME")
            .distinct()
            .sort()
            .getInfo()
        )
        return [name for name in names or [] if name]
    except ee.EEException as exc:
        raise RuntimeError(
            f"Erro ao obter as províncias no Google Earth Engine: {exc}"
        ) from exc


def get_forest_dynamics(
    start_year=DEFAULT_START_YEAR,
    end_year=DEFAULT_END_YEAR,
    scope="country",
    area_name=None,
    geometry=None,
):
    """Return change tiles, annual tree-cover area and transition summaries."""
    start_year, end_year, scope, area_name = validate_forest_dynamics_parameters(
        start_year, end_year, scope, area_name, geometry
    )
    custom_geometries = (
        _normalize_custom_geometries(geometry) if scope == "custom" else None
    )

    if not initialize_gee():
        raise RuntimeError("Google Earth Engine não pôde ser inicializado.")

    region, region_name, analysis_scale = _analysis_region(
        scope, area_name, custom_geometries
    )

    try:
        annual_images = {
            year: _annual_landcover(region, year)
            for year in range(start_year, end_year + 1)
        }
        start_landcover = annual_images[start_year]
        end_landcover = annual_images[end_year]

        # Use the same valid-data footprint for every year so that apparent
        # gains or losses cannot be caused by changing observation coverage.
        comparable = start_landcover.mask()
        for year in range(start_year + 1, end_year + 1):
            comparable = comparable.And(annual_images[year].mask())

        start_forest = start_landcover.eq(TREE_CLASS)
        end_forest = end_landcover.eq(TREE_CLASS)
        stable_forest = start_forest.And(end_forest).And(comparable)
        forest_loss = start_forest.And(end_forest.Not()).And(comparable)
        forest_gain = start_forest.Not().And(end_forest).And(comparable)

        change = (
            ee.Image(0)
            .where(stable_forest, 1)
            .where(forest_loss, 2)
            .where(forest_gain, 3)
            .updateMask(stable_forest.Or(forest_loss).Or(forest_gain))
            .rename("forest_change")
            .clip(region)
        )

        annual_area_bands = ee.Image.cat(
            *[
                _area_band(
                    annual_images[year].eq(TREE_CLASS).And(comparable),
                    f"forest_{year}",
                )
                for year in range(start_year, end_year + 1)
            ]
        )
        change_area_bands = ee.Image.cat(
            _area_band(start_forest.And(comparable), "initial_forest_ha"),
            _area_band(end_forest.And(comparable), "final_forest_ha"),
            _area_band(stable_forest, "stable_forest_ha"),
            _area_band(forest_loss, "forest_loss_ha"),
            _area_band(forest_gain, "forest_gain_ha"),
        )

        computed = ee.Dictionary(
            {
                "annual": _reduce_area_bands(
                    annual_area_bands, region, analysis_scale
                ),
                "change": _reduce_area_bands(
                    change_area_bands, region, analysis_scale
                ),
                "loss_to": _transition_areas(
                    forest_loss, end_landcover, region, analysis_scale
                ),
                "gain_from": _transition_areas(
                    forest_gain, start_landcover, region, analysis_scale
                ),
            }
        ).getInfo()

        annual_values = computed.get("annual") or {}
        time_series = []
        previous_area = None
        for year in range(start_year, end_year + 1):
            forest_area = round(
                float(annual_values.get(f"forest_{year}", 0) or 0), 2
            )
            time_series.append(
                {
                    "year": year,
                    "forest_area_ha": forest_area,
                    "annual_change_ha": (
                        None
                        if previous_area is None
                        else round(forest_area - previous_area, 2)
                    ),
                }
            )
            previous_area = forest_area

        change_values = computed.get("change") or {}
        initial_forest = float(change_values.get("initial_forest_ha", 0) or 0)
        final_forest = float(change_values.get("final_forest_ha", 0) or 0)
        forest_loss_area = float(change_values.get("forest_loss_ha", 0) or 0)
        forest_gain_area = float(change_values.get("forest_gain_ha", 0) or 0)
        net_change = final_forest - initial_forest

        map_id = change.getMapId(
            {
                "min": 1,
                "max": 3,
                "palette": [item["color"] for item in CHANGE_LEGEND],
            }
        )

        return {
            "gee_layer": {
                "mapid": map_id["mapid"],
                "token": map_id.get("token", ""),
                "tile_url": map_id["tile_fetcher"].url_format,
            },
            "stats": {
                "initial_forest_ha": round(initial_forest, 2),
                "final_forest_ha": round(final_forest, 2),
                "stable_forest_ha": round(
                    float(change_values.get("stable_forest_ha", 0) or 0), 2
                ),
                "forest_loss_ha": round(forest_loss_area, 2),
                "forest_gain_ha": round(forest_gain_area, 2),
                "gross_change_ha": round(forest_loss_area + forest_gain_area, 2),
                "net_change_ha": round(net_change, 2),
                "net_change_pct": (
                    round((net_change / initial_forest) * 100, 2)
                    if initial_forest
                    else None
                ),
            },
            "timeseries": time_series,
            "transitions": {
                "loss_to": _format_transition_groups(
                    (computed.get("loss_to") or {}).get("groups")
                ),
                "gain_from": _format_transition_groups(
                    (computed.get("gain_from") or {}).get("groups")
                ),
            },
            "metadata": {
                "country": "Mozambique",
                "region": region_name,
                "scope": scope,
                "geometry_source": (
                    "GeoJSON enviado pelo utilizador"
                    if scope == "custom"
                    else "FAO GAUL 2015"
                ),
                "start_year": start_year,
                "end_year": end_year,
                "dataset": DYNAMIC_WORLD_DATASET,
                "forest_definition": "Dynamic World: classe trees (valor 1)",
                "map_resolution_m": 10,
                "analysis_scale_m": analysis_scale,
                "analysis_crs": ANALYSIS_CRS,
                "analysis_sampling": "Amostragem categórica por vizinho mais próximo",
                "annual_composite": "Moda anual da classe mais provável",
                "minimum_annual_observations": MIN_ANNUAL_OBSERVATIONS,
                "comparison_mask": "Pixels válidos em todos os anos selecionados",
                "legend": CHANGE_LEGEND,
                "disclaimer": (
                    "A classe árvores inclui floresta primária, floresta secundária "
                    "e plantações. Os resultados são estimativas de triagem e devem "
                    "ser validados com dados locais e interpretação visual."
                ),
            },
        }
    except ee.EEException as exc:
        raise RuntimeError(
            f"Erro ao processar a dinâmica florestal no Google Earth Engine: {exc}"
        ) from exc
