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

def get_lulc_tiles():
    """
    Retorna a camada de Classificação LULC baseada no ESA WorldCover.
    """
    if not initialize_gee():
        raise Exception("Google Earth Engine não pôde ser inicializado.")

    try:
        # Load ESA WorldCover (2021) v200
        dataset = ee.ImageCollection('ESA/WorldCover/v200').first()
        lulc = dataset.select('Map')

        # Remap to custom classes to simplify the map:
        # ESA: 10(Tree), 20(Shrub), 30(Grass), 40(Crop), 50(Built), 60(Bare), 70(Snow), 80(Water), 90(Wetland), 95(Mangrove), 100(Moss)
        # Custom: 1(Veg), 2(Agri), 3(Bare), 4(Water), 5(Urban)
        from_list = [10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 100]
        to_list =   [1,  1,  1,  2,  5,  3,  3,  4,  4,  1,  1]
        
        remapped = lulc.remap(from_list, to_list)

        # Palette colors
        # 1: Vegetation (Dark Green - 006400)
        # 2: Agriculture (Light Green - 90EE90)
        # 3: Bare Soil (Yellow - FFFF00)
        # 4: Water (Cyan - 00FFFF)
        # 5: Urban (Grey - 808080)
        
        vis_params = {
            'min': 1,
            'max': 5,
            'palette': [
                '006400', # 1 - Veg
                '90EE90', # 2 - Agri
                'FFFF00', # 3 - Bare
                '00FFFF', # 4 - Water
                '808080', # 5 - Urban
            ]
        }
        
        map_id_dict = remapped.getMapId(vis_params)
        
        return {
            'mapid': map_id_dict['mapid'],
            'token': map_id_dict['token'],
            'tile_url': map_id_dict['tile_fetcher'].url_format
        }

    except Exception as e:
        raise Exception(f"Erro ao processar mapa LULC no GEE: {e}")

def get_lithology_tiles(mineral_type='kaolinite'):
    """
    Retorna a camada de análise litológica baseada no satélite ASTER.
    mineral_type: 'kaolinite', 'alunite', 'calcite', 'quartz', 'carbonate', 'mafic'
    """
    if not initialize_gee():
        raise Exception("Google Earth Engine não pôde ser inicializado.")

    try:
        # ASTER L1T collection
        aster = (ee.ImageCollection("ASTER/AST_L1T_003")
                 .filter(ee.Filter.lt('CLOUDCOVER', 10))
                 .filter(ee.Filter.calendarRange(6, 9, 'month'))
                 .mean())
                 
        # DOS (Dark Object Subtraction) - Região Base de Cabo Delgado
        cabo_delgado = ee.FeatureCollection("FAO/GAUL/2015/level1")\
            .filter(ee.Filter.And(
                ee.Filter.eq('ADM0_NAME', 'Mozambique'),
                ee.Filter.eq('ADM1_NAME', 'Cabo Delgado')
            )).geometry()

        ms_bands = ['B01', 'B02', 'B3N', 'B04', 'B05', 'B06', 'B07', 'B08', 'B09']
        tir_bands = ['B10', 'B11', 'B12', 'B13', 'B14']
        
        ms = aster.select(ms_bands)
        tir = aster.select(tir_bands)
        
        dark_object = ms.reduceRegion(
            reducer=ee.Reducer.min(), 
            geometry=cabo_delgado, 
            scale=500,
            maxPixels=1e9
        )
        
        # Subtrair os mínimos para correção atmosférica
        min_img = ee.Image.constant(dark_object.values(ms_bands)).rename(ms_bands)
        aster_cor = ms.subtract(min_img).addBands(tir)
        
        # Expressões dos Índices Minerais
        expressions = {
            'kaolinite': '(b("B04") / b("B05")) * (b("B08") / b("B06"))',
            'alunite': '(b("B07") / b("B05")) * (b("B07") / b("B08"))',
            'calcite': '(b("B06") / b("B08")) * (b("B09") / b("B08"))',
            'quartz': '(b("B11") * b("B11")) / (b("B10") * b("B12"))',
            'carbonate': 'b("B13") / b("B14")',
            'mafic': 'b("B12") / b("B13")'
        }

        if mineral_type not in expressions:
            raise ValueError(f"Mineral '{mineral_type}' não suportado.")

        index_img = aster_cor.expression(expressions[mineral_type])

        # Mapa de Calor (Heatmap) Viridis
        vis_params = {
            'min': 0.8,
            'max': 1.3, # Ratios costumam andar à volta do 1.0
            'palette': ['440154', '414487', '2a788e', '22a884', '7ad151', 'fde725'] 
        }
        
        map_id_dict = index_img.getMapId(vis_params)
        
        return {
            'mapid': map_id_dict['mapid'],
            'token': map_id_dict['token'],
            'tile_url': map_id_dict['tile_fetcher'].url_format
        }

    except Exception as e:
        raise Exception(f"Erro ao processar análise litológica no GEE: {e}")


# --- ÁGUAS SUBTERRÂNEAS (GLDAS) ---

GLDAS_DATASET = "NASA/GLDAS/V022/CLSM/G025/DA1D"
GLDAS_BAND = "GWS_tavg"
GLDAS_NATIVE_SCALE = 27830

def get_groundwater_tiles(year, month):
    """
    Retorna a camada de visualização de Águas Subterrâneas (GLDAS) para um dado mês/ano.
    """
    if not initialize_gee():
        raise Exception("Google Earth Engine não pôde ser inicializado.")

    try:
        start = ee.Date.fromYMD(year, month, 1)
        end = start.advance(1, "month")
        
        image = (
            ee.ImageCollection(GLDAS_DATASET)
            .select(GLDAS_BAND)
            .filterDate(start, end)
            .mean()
            .rename("Groundwater")
        )
        
        vis_params = {
            'min': 200,
            'max': 2000,
            'palette': ["7F3B08", "F7B267", "9ACD32", "2E8B57", "1E6091"]
        }
        
        map_id_dict = image.getMapId(vis_params)
        return {
            'mapid': map_id_dict['mapid'],
            'token': map_id_dict['token'],
            'tile_url': map_id_dict['tile_fetcher'].url_format
        }

    except Exception as e:
        raise Exception(f"Erro ao processar tiles GLDAS: {e}")

def _monthly_collection(start_iso: str, end_iso: str):
    start_ee = ee.Date(start_iso)
    end_ee = ee.Date(end_iso).advance(1, "day")
    daily = ee.ImageCollection(GLDAS_DATASET).select(GLDAS_BAND).filterDate(start_ee, end_ee)

    month_count = end_ee.difference(start_ee, "month").ceil()
    offsets = ee.List.sequence(0, month_count.subtract(1))

    def aggregate_month(offset):
        offset = ee.Number(offset)
        month_start = start_ee.advance(offset, "month")
        month_end = month_start.advance(1, "month")
        source = daily.filterDate(month_start, month_end)
        image = source.mean().rename("Groundwater")
        return image.set({
            "system:time_start": month_start.millis(),
            "date": month_start.format("YYYY-MM-dd"),
            "image_count": source.size(),
        })

    return ee.ImageCollection(offsets.map(aggregate_month)).filter(
        ee.Filter.gt("image_count", 0)
    )

def get_groundwater_timeseries(start_iso, end_iso, points_list):
    """
    Gera a série temporal de Águas Subterrâneas para o país e para pontos específicos.
    points_list: [{'name': 'Ponto 1', 'lng': 35.5, 'lat': -18.5}, ...]
    """
    if not initialize_gee():
        raise Exception("Google Earth Engine não pôde ser inicializado.")
        
    try:
        collection = _monthly_collection(start_iso, end_iso)
        
        sampled_features = ee.FeatureCollection([])
        if points_list:
            features = []
            for pt in points_list:
                features.append(
                    ee.Feature(
                        ee.Geometry.Point([float(pt['lng']), float(pt['lat'])]),
                        {"location": pt['name']}
                    )
                )
            regions = ee.FeatureCollection(features)
            
            def sample_month(image, accumulator):
                sampled = ee.Image(image).reduceRegions(
                    collection=regions,
                    reducer=ee.Reducer.mean(),
                    scale=GLDAS_NATIVE_SCALE,
                )
                current_date = ee.Image(image).get("date")
                dated = sampled.map(
                    lambda feature: ee.Feature(feature).set(
                        {"date": current_date, "value_mm": feature.get("mean")}
                    )
                )
                return ee.FeatureCollection(accumulator).merge(dated)

            sampled_features = ee.FeatureCollection(
                collection.iterate(sample_month, ee.FeatureCollection([]))
            )
        
        # Média Nacional (Moçambique)
        mz_region = ee.FeatureCollection("USDOS/LSIB_SIMPLE/2017").filter(ee.Filter.eq("country_na", "Mozambique")).geometry()
        
        def summarize_national(image, accumulator):
            value = ee.Image(image).reduceRegion(
                reducer=ee.Reducer.mean(),
                geometry=mz_region,
                scale=GLDAS_NATIVE_SCALE,
                bestEffort=True,
                maxPixels=1e9,
            ).get("Groundwater")
            feature = ee.Feature(
                None, {"location": "Moçambique (Média)", "date": ee.Image(image).get("date"), "value_mm": value}
            )
            return ee.FeatureCollection(accumulator).merge(ee.FeatureCollection([feature]))
            
        national_features = ee.FeatureCollection(
            collection.iterate(summarize_national, ee.FeatureCollection([]))
        )
        
        combined = sampled_features.merge(national_features)
        results = combined.getInfo()
        
        # Formatar para o Recharts
        data = [f['properties'] for f in results.get('features', []) if f['properties'].get('value_mm') is not None]
        
        formatted_data = {}
        for row in data:
            date_str = row['date']
            loc = row['location']
            val = row['value_mm']
            
            if date_str not in formatted_data:
                formatted_data[date_str] = {'date': date_str}
            formatted_data[date_str][loc] = round(val, 2)
            
        chart_data = list(formatted_data.values())
        chart_data.sort(key=lambda x: x['date'])
        
        return chart_data
        
    except Exception as e:
        raise Exception(f"Erro ao processar série temporal GLDAS: {e}")
