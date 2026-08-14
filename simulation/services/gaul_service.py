"""
Serviço GEE para limites administrativos FAO GAUL 2015.
Suporta level1 (Províncias) e level2 (Distritos) de Moçambique.
"""
from functools import lru_cache
import unicodedata

import ee
from georisksim.gee_auth import initialize_gee

# Estilo visual por nível
ADMIN_LEVEL_STYLES = {
    'level1': {'color': 'FF6B35', 'width': 2.0},  # laranja — Províncias
    'level2': {'color': '4ECDC4', 'width': 1.2},  # ciano  — Distritos
}

GAUL_NAME_FIELD = {
    'level1': 'ADM1_NAME',
    'level2': 'ADM2_NAME',
}


def _normalize_admin_name(value):
    """Normaliza nomes para pesquisa sem distinguir maiúsculas ou acentos."""
    normalized = unicodedata.normalize('NFKD', str(value or ''))
    return ''.join(
        character for character in normalized
        if not unicodedata.combining(character)
    ).casefold().strip()


def match_admin_names(query, names, limit=20):
    """Retorna nomes GAUL exactos ordenados pela proximidade da pesquisa."""
    normalized_query = _normalize_admin_name(query)
    if len(normalized_query) < 2:
        return []

    ranked = []
    for name in names:
        normalized_name = _normalize_admin_name(name)
        if normalized_query not in normalized_name:
            continue

        if normalized_name == normalized_query:
            rank = 0
        elif normalized_name.startswith(normalized_query):
            rank = 1
        else:
            rank = 2
        ranked.append((rank, len(normalized_name), normalized_name, name))

    ranked.sort(key=lambda item: item[:3])
    return [item[3] for item in ranked[:max(1, int(limit))]]


def _bbox_from_coordinates(coordinates):
    """Calcula [oeste, sul, este, norte] para coordenadas GeoJSON aninhadas."""
    points = []

    def collect(value):
        if (
            isinstance(value, (list, tuple))
            and len(value) >= 2
            and isinstance(value[0], (int, float))
            and isinstance(value[1], (int, float))
        ):
            points.append((float(value[0]), float(value[1])))
            return
        if isinstance(value, (list, tuple)):
            for child in value:
                collect(child)

    collect(coordinates)
    if not points:
        return None

    longitudes, latitudes = zip(*points)
    return [min(longitudes), min(latitudes), max(longitudes), max(latitudes)]


@lru_cache(maxsize=8)
def _get_admin_names(level, country_filter):
    name_field = GAUL_NAME_FIELD[level]
    collection = (
        ee.FeatureCollection(f'FAO/GAUL/2015/{level}')
        .filter(ee.Filter.eq('ADM0_NAME', country_filter))
    )
    return tuple(
        collection.aggregate_array(name_field).distinct().sort().getInfo() or []
    )


def _matching_admin_names(level, query, country_filter, limit=20):
    return match_admin_names(
        query,
        _get_admin_names(level, country_filter),
        limit=limit,
    )


def search_gaul_admin_areas(
    query,
    level=None,
    country_filter='Mozambique',
    limit=8,
):
    """Pesquisa províncias/distritos e devolve geometria mínima para navegação."""
    normalized_query = str(query or '').strip()
    if len(normalized_query) < 2:
        return []
    if level and level not in GAUL_NAME_FIELD:
        raise ValueError(f"Nível inválido: '{level}'. Use 'level1' ou 'level2'.")
    if not initialize_gee():
        raise Exception("Google Earth Engine não pôde ser inicializado.")

    result_limit = max(1, min(int(limit), 20))
    levels = [level] if level else ['level1', 'level2']
    results = []

    try:
        for admin_level in levels:
            if len(results) >= result_limit:
                break

            name_field = GAUL_NAME_FIELD[admin_level]
            exact_names = _matching_admin_names(
                admin_level,
                normalized_query,
                country_filter,
                limit=result_limit - len(results),
            )
            if not exact_names:
                continue

            collection = (
                ee.FeatureCollection(f'FAO/GAUL/2015/{admin_level}')
                .filter(ee.Filter.eq('ADM0_NAME', country_filter))
                .filter(ee.Filter.inList(name_field, exact_names))
            )

            def summarize(feature):
                geometry = feature.geometry()
                properties = {
                    'name': feature.get(name_field),
                    'parent_name': feature.get('ADM1_NAME'),
                    'centroid': geometry.centroid(100).coordinates(),
                    'bounds': geometry.bounds(100).coordinates(),
                }
                return ee.Feature(None, properties)

            features = collection.map(summarize).getInfo().get('features', [])
            by_name = {
                feature.get('properties', {}).get('name'): feature
                for feature in features
            }

            # Preserva a ordenação de relevância calculada localmente.
            for name in exact_names:
                feature = by_name.get(name)
                if not feature:
                    continue
                properties = feature.get('properties', {})
                centroid = properties.get('centroid')
                bbox = _bbox_from_coordinates(properties.get('bounds'))
                if not centroid or not bbox:
                    continue
                results.append({
                    'id': f'{admin_level}:{name}',
                    'name': name,
                    'level': admin_level,
                    'level_label': 'Província' if admin_level == 'level1' else 'Distrito',
                    'parent_name': properties.get('parent_name') if admin_level == 'level2' else None,
                    'country': country_filter,
                    'centroid': centroid,
                    'bounds': bbox,
                })
                if len(results) >= result_limit:
                    break

        return results
    except ee.EEException as exc:
        raise Exception(f'Erro GEE ao pesquisar limites administrativos: {exc}') from exc


def get_gaul_admin_tiles(level='level1', name_filter='', country_filter='Mozambique'):
    """
    Devolve tiles de limites administrativos FAO GAUL 2015.

    :param level:          'level1' (Províncias) ou 'level2' (Distritos)
    :param name_filter:    filtra por nome parcial do admin (sem distinguir caixa/acentos)
    :param country_filter: país (default: Mozambique)
    :return: dict com tile_url e metadados (sem getInfo() — não bloqueia o servidor)
    """
    if not initialize_gee():
        raise Exception("Google Earth Engine não pôde ser inicializado.")

    if level not in ADMIN_LEVEL_STYLES:
        raise ValueError(f"Nível inválido: '{level}'. Use 'level1' ou 'level2'.")

    try:
        fc = ee.FeatureCollection(f'FAO/GAUL/2015/{level}')

        # Filtrar por país
        fc = fc.filter(ee.Filter.eq('ADM0_NAME', country_filter))

        # Filtrar por nome (apenas se tiver pelo menos 2 caracteres)
        name_field = GAUL_NAME_FIELD[level]
        if name_filter and len(name_filter.strip()) >= 2:
            exact_names = _matching_admin_names(
                level,
                name_filter,
                country_filter,
            )
            fc = fc.filter(ee.Filter.inList(name_field, exact_names))

        # Converter FeatureCollection em imagem de contornos estilizados
        style = ADMIN_LEVEL_STYLES[level]
        styled = fc.style(
            color=style['color'],
            width=style['width'],
            fillColor='00000000',  # preenchimento transparente
        )

        # Nota: getMapId() é assíncrono no servidor GEE, não bloqueia
        map_id_dict = styled.getMapId({})

        return {
            'level': level,
            'dataset': f'FAO/GAUL/2015/{level}',
            'country': country_filter,
            'name_filter': name_filter,
            'tile_url': map_id_dict['tile_fetcher'].url_format,
        }

    except ee.EEException as e:
        raise Exception(f"Erro GEE ao carregar GAUL {level}: {e}")
    except Exception as e:
        raise Exception(f"Erro ao carregar limites administrativos ({level}): {e}")
