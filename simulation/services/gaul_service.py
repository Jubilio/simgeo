"""
Serviço GEE para limites administrativos FAO GAUL 2015.
Suporta level1 (Províncias) e level2 (Distritos) de Moçambique.
"""
import ee
from georisksim.gee_auth import initialize_gee
from .mozambique_geometry import get_mozambique_geometry

# Estilo visual por nível
ADMIN_LEVEL_STYLES = {
    'level1': {'color': 'FF6B35', 'width': 2.0},  # laranja — Províncias
    'level2': {'color': '4ECDC4', 'width': 1.2},  # ciano  — Distritos
}

GAUL_NAME_FIELD = {
    'level1': 'ADM1_NAME',
    'level2': 'ADM2_NAME',
}


def get_gaul_admin_tiles(level='level1', name_filter='', country_filter='Mozambique'):
    """
    Devolve tiles de limites administrativos FAO GAUL 2015.

    :param level:          'level1' (Províncias) ou 'level2' (Distritos)
    :param name_filter:    filtra por nome parcial do admin (case-sensitive no GEE)
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
            fc = fc.filter(ee.Filter.stringContains(name_field, name_filter.strip()))

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
