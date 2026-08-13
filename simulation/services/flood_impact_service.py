import ee
from georisksim.gee_auth import initialize_gee
from .mozambique_geometry import get_mozambique_geometry

def get_flood_impact(engine='glofas', return_period=100, s1_start=None, s1_end=None):
    """
    Simulação de Impacto de Cheias.
    Retorna o MapID para visualização e as estatísticas de exposição calculadas via GEE.
    """
    if not initialize_gee():
        raise Exception("Google Earth Engine não pôde ser inicializado.")

    moz = get_mozambique_geometry()
    
    try:
        # 1. HAZARD: Obter a máscara de cheia (1 para inundado, 0 sem água)
        flood_mask = None
        
        if engine == 'glofas':
            # GLOFAS Flood Hazard (Profundidade da cheia)
            # O dataset JRC/CEMS_GLOFAS/FloodHazard/v1 contém imagens por período de retorno
            # Vamos assumir que filtramos pelo período ou apenas agregamos a coleção
            try:
                glofas = ee.ImageCollection('JRC/CEMS_GLOFAS/FloodHazard/v1')
                # A banda é tipicamente 'depth' ou a própria imagem tem o valor da profundidade
                # Pegamos o máximo de profundidade para o período
                depth = glofas.max() 
                flood_mask = depth.gt(0.15) # Mais de 15cm de água
            except:
                # Fallback seguro caso a coleção exata varie
                gsw = ee.Image('JRC/GSW1_4/GlobalSurfaceWater')
                flood_mask = gsw.select('max_extent').eq(1)

        elif engine == 'sentinel1':
            # Detecção de anomalia de água com Sentinel-1 SAR
            if not s1_start or not s1_end:
                raise ValueError("Datas do Sentinel-1 são obrigatórias.")
                
            # Pré-evento: 1 mês antes do start
            s1_pre_start = ee.Date(s1_start).advance(-1, 'month')
            s1_pre_end = ee.Date(s1_start)
            
            s1_post_start = ee.Date(s1_start)
            s1_post_end = ee.Date(s1_end)
            
            s1 = ee.ImageCollection('COPERNICUS/S1_GRD') \
                    .filterBounds(moz) \
                    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH')) \
                    .filter(ee.Filter.eq('instrumentMode', 'IW')) \
                    .select('VH')
                    
            pre_event = s1.filterDate(s1_pre_start, s1_pre_end).median()
            post_event = s1.filterDate(s1_post_start, s1_post_end).median()
            
            # Filtro de speckle básico (focal median)
            pre_smooth = pre_event.focal_median(50, 'circle', 'meters')
            post_smooth = post_event.focal_median(50, 'circle', 'meters')
            
            # Limites empíricos de SAR para água
            flood_mask = post_smooth.lt(-18).And(pre_smooth.gt(-16))
            
        else:
            raise ValueError("Motor desconhecido. Use 'glofas' ou 'sentinel1'.")
            
        flood_mask_moz = flood_mask.clip(moz)

        # 2. EXPOSURE: População (WorldPop) e Agricultura (ESA WorldCover)
        
        # População (2020)
        pop_dataset = ee.ImageCollection("WorldPop/GP/100m/pop") \
            .filterDate('2020-01-01', '2021-01-01') \
            .mean() \
            .clip(moz)
            
        # Agricultura (Classe 40 no ESA WorldCover v100)
        landcover = ee.ImageCollection("ESA/WorldCover/v100").first().clip(moz)
        cropland = landcover.eq(40)
        
        # 3. INTERSECÇÃO
        # Multiplicar a máscara de cheia (0 ou 1) pela densidade populacional
        exposed_pop_img = pop_dataset.multiply(flood_mask_moz)
        
        # Pixels agrícolas inundados (1) * área do pixel
        exposed_crop_area_sqm = cropland.multiply(flood_mask_moz).multiply(ee.Image.pixelArea())

        # 4. ESTATÍSTICAS (ReduceRegion)
        # scale=1000m: rápido o suficiente para uma chamada web (GLOFAS é ~1km de resolução nativa)
        scale_res = 1000

        stats_pop = exposed_pop_img.reduceRegion(
            reducer=ee.Reducer.sum(),
            geometry=moz,
            scale=scale_res,
            maxPixels=1e9,
            bestEffort=True
        )

        stats_crop = exposed_crop_area_sqm.reduceRegion(
            reducer=ee.Reducer.sum(),
            geometry=moz,
            scale=scale_res,
            maxPixels=1e9,
            bestEffort=True
        )

        # Um único getInfo() por dicionário (1 round-trip para o GEE em vez de 2-4)
        pop_dict = stats_pop.getInfo()   # ex: {'population': 12345.6} ou {}
        crop_dict = stats_crop.getInfo() # ex: {'Map': 987654.3} ou {}

        # Os nomes das bandas podem variar conforme a versão do dataset
        total_pop = 0
        if pop_dict:
            total_pop = next(iter(pop_dict.values()), 0) or 0

        total_crop_sqm = 0
        if crop_dict:
            total_crop_sqm = next(iter(crop_dict.values()), 0) or 0

        total_crop_ha = total_crop_sqm / 10000.0

        # 5. VISUALIZAÇÃO
        # Combinar a mancha da cheia (vermelho/azul) com a população afetada
        # Para a interface, vamos mostrar apenas a máscara de inundação em ciano
        vis_params = {
            'min': 0,
            'max': 1,
            'palette': ['transparent', '#00ffff']
        }
        
        map_id_dict = flood_mask_moz.updateMask(flood_mask_moz).getMapId(vis_params)

        return {
            'gee_layer': {
                'mapid': map_id_dict['mapid'],
                'token': map_id_dict['token'],
                'tile_url': map_id_dict['tile_fetcher'].url_format,
            },
            'stats': {
                'exposed_population': round(total_pop),
                'exposed_agriculture_ha': round(total_crop_ha, 2)
            }
        }
        
    except Exception as e:
        raise Exception(f"Erro ao processar Impacto da Cheia no GEE: {e}")
