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

def calculate_affected_infrastructure(water_level, infrastructure_geojson_list):
    """
    Recebe uma lista de infraestruturas (pontos/GeoJSON) e cruza com a elevação (DEM)
    no Earth Engine. Devolve os IDs das infraestruturas que estão abaixo do nível de água.
    """
    if not initialize_gee():
        raise Exception("Google Earth Engine não pôde ser inicializado.")

    if not infrastructure_geojson_list:
        return []

    try:
        # Converter os dados GeoJSON locais para ee.FeatureCollection
        # infrastructure_geojson_list deve ser uma lista de dicionários GeoJSON Feature
        ee_features = []
        for feat in infrastructure_geojson_list:
            # GEE pede as coordenadas em list [lon, lat]
            coords = feat['geometry']['coordinates']
            props = feat['properties']
            props['id'] = feat['id']
            ee_features.append(ee.Feature(ee.Geometry.Point(coords), props))
            
        fc = ee.FeatureCollection(ee_features)

        # Carrega o DEM Global
        dem = ee.Image('USGS/SRTMGL1_003')

        # Reduzir o DEM nos pontos da FeatureCollection
        # Isto vai adicionar uma propriedade 'elevation' a cada Feature
        sampled_fc = dem.reduceRegions(
            collection=fc,
            reducer=ee.Reducer.first(),
            scale=30
        )

        # Obter os resultados de volta para o Python (isto executa a query real na cloud da Google)
        results = sampled_fc.getInfo()
        
        affected_ids = []
        for r in results.get('features', []):
            # SRTM band name is typically 'elevation'
            elev = r['properties'].get('elevation')
            # Se a elevação for válida e menor ou igual ao nível da água
            if elev is not None and elev <= water_level:
                affected_ids.append(r['properties']['id'])
                
        return affected_ids

    except Exception as e:
        raise Exception(f"Erro na análise espacial do GEE: {e}")
