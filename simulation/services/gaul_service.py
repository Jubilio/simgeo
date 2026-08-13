import ee
from georisksim.gee_auth import initialize_gee

# Cores por nível administrativo
ADMIN_LEVEL_COLORS = {
    'level1': {'color': 'FF6B35', 'width': 2.0},   # laranja - Províncias
    'level2': {'color': '4ECDC4', 'width': 1.5},   # ciano - Distritos
}

# Nomes dos campos por dataset GAUL
GAUL_FIELDS = {
    'level1': {'name': 'ADM1_NAME', 'country': 'ADM0_NAME'},
    'level2': {'name': 'ADM2_NAME', 'country': 'ADM0_NAME'},
}

def get_gaul_admin_tiles(level='level1', name_filter='', country_filter='Mozambique'):
    """
    Devolve tiles de limites administrativos FAO GAUL 2015.
    
    :param level: 'level1' (Províncias) ou 'level2' (Distritos)
    :param name_filter: filtra por nome do admin (parcial, case-insensitive)
    :param country_filter: filtra por país (default: Mozambique)
    :return: dict com tile_url e metadados
    """
    if not initialize_gee():
        raise Exception("Google Earth Engine não pôde ser inicializado.")

    if level not in ('level1', 'level2'):
        raise ValueError(f"Nível inválido: {level}. Use 'level1' ou 'level2'.")

    try:
        dataset_id = f'FAO/GAUL/2015/{level}'
        fc = ee.FeatureCollection(dataset_id)

        # Filtrar por país
        if country_filter:
            fc = fc.filter(ee.Filter.eq('ADM0_NAME', country_filter))

        # Filtrar por nome do admin (procura em ADM1_NAME ou ADM2_NAME)
        name_field = GAUL_FIELDS[level]['name']
        if name_filter and name_filter.strip():
            fc = fc.filter(
                ee.Filter.stringContains(name_field, name_filter)
            )

        # Estilo visual: linha de contorno
        color = ADMIN_LEVEL_COLORS[level]['color']

        # Converter para imagem de contornos (painted edges)
        styled = fc.style(**{
            'color': color,
            'width': ADMIN_LEVEL_COLORS[level]['width'],
            'fillColor': '00000000',  # transparente
        })

        vis_params = {}
        map_id_dict = styled.getMapId(vis_params)

        return {
            'level': level,
            'dataset': dataset_id,
            'country': country_filter,
            'name_filter': name_filter,
            'feature_count': fc.size().getInfo(),
            'tile_url': map_id_dict['tile_fetcher'].url_format,
        }

    except ee.EEException as e:
        raise Exception(f"Erro GEE ao carregar GAUL {level}: {e}")
    except Exception as e:
        raise Exception(f"Erro inesperado GAUL {level}: {e}")
