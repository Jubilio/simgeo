import ee
from georisksim.gee_auth import initialize_gee

def get_flood_simulation_tiles(water_level=2.0):
    """
    Usa um Modelo Digital de Elevação (SRTM) para simular inundações costeiras
    ou subida do nível da água, devolvendo um MapID e Token para o Leaflet.
    
    :param water_level: Float representando a elevação (cota) em metros da água.
    """
    # Garante que o GEE está inicializado
    if not initialize_gee():
        raise Exception("Google Earth Engine não pôde ser inicializado.")

    try:
        # Carrega o DEM Global da NASA (SRTM Digital Elevation Data 30m)
        dem = ee.Image('USGS/SRTMGL1_003')

        # Cria uma máscara para onde a elevação é <= water_level
        # Os valores de elevação do SRTM para oceanos/água já são 0 ou < 0 em muitos casos,
        # mas queremos ver a expansão da água acima da costa (ex: 2 metros acima do nível do mar)
        flood_mask = dem.lte(water_level)

        # Remove áreas que não estão inundadas (transparente)
        flooded_area = flood_mask.updateMask(flood_mask)

        # Paleta visual para a água (azul vibrante)
        vis_params = {
            'min': 1,
            'max': 1,
            'palette': ['00FFFF'] # Cyan/Azul claro para se destacar no mapa escuro
        }

        # Obtém os parâmetros do Tile Server do Google (MapID e Token)
        map_id_dict = ee.Image(flooded_area).getMapId(vis_params)
        
        return {
            'mapid': map_id_dict['mapid'],
            'token': map_id_dict['token'],
            'tile_url': map_id_dict['tile_fetcher'].url_format
        }

    except Exception as e:
        raise Exception(f"Erro ao processar imagem no GEE: {e}")
