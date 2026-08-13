import ee
from georisksim.gee_auth import initialize_gee
from .mozambique_geometry import get_mozambique_geometry

# Ciclones predefinidos (datas de pico)
CYCLONE_EVENTS = {
    'idai': {
        'name': 'Ciclone Idai (2019)',
        'start': '2019-03-14',
        'end': '2019-03-16'
    },
    'kenneth': {
        'name': 'Ciclone Kenneth (2019)',
        'start': '2019-04-24',
        'end': '2019-04-26'
    },
    'freddy': {
        'name': 'Ciclone Freddy (2023)',
        'start': '2023-03-11',
        'end': '2023-03-13'
    }
}

def get_cyclone_tiles(start_date, end_date, layer_type='rain'):
    """
    Retorna os tiles GEE para simulação de ciclones:
    - 'rain': Precipitação total acumulada (GPM IMERG)
    - 'wind': Máxima rajada de vento (ERA5)
    """
    if not initialize_gee():
        raise Exception("Google Earth Engine não pôde ser inicializado.")

    moz = get_mozambique_geometry()
    
    try:
        # Converter datas para ee.Date
        # O GEE filterDate é exclusivo no endDate, então adicionamos 1 dia para cobrir o último dia.
        start = ee.Date(start_date)
        end = ee.Date(end_date).advance(1, 'day')
        
        if layer_type == 'rain':
            # GPM IMERG Half-hourly precipitation (convertido para mm/h e acumulado)
            # O dataset GPM_L3/IMERG_V06 (calibrado)
            dataset = ee.ImageCollection('NASA/GPM_L3/IMERG_V06') \
                .filterDate(start, end) \
                .select('precipitationCal')
            
            # Somar a precipitação no período (como cada imagem é 30min, sum() daria mm/h * 30min?)
            # O IMERG V06 'precipitationCal' é medido em mm/hr. Para obter mm total num período de meia hora, dividimos por 2.
            # Multiplicar por 0.5 e somar tudo.
            total_rain = dataset.map(lambda img: img.multiply(0.5)).sum()
            
            img_to_vis = total_rain.clip(moz)
            
            # Heatmap de precipitação: transparente até 20mm, depois azul->ciano->verde->amarelo->vermelho (chuva extrema)
            vis_params = {
                'min': 20,
                'max': 300, 
                'palette': ['#e0f3db', '#a8ddb5', '#4eb3d3', '#2b8cbe', '#0868ac', '#084081', '#ffc107', '#ff5722', '#b30000']
            }
            
            map_id_dict = img_to_vis.getMapId(vis_params)
            
        elif layer_type == 'wind':
            # ECMWF ERA5 Daily Aggregates - Maximum 10m wind gust
            # Medido em m/s
            dataset = ee.ImageCollection('ECMWF/ERA5/DAILY') \
                .filterDate(start, end) \
                .select('maximum_10m_wind_gust')
            
            # Máximo absoluto durante o período
            max_wind = dataset.max()
            
            # Converter de m/s para km/h (multiplicar por 3.6)
            wind_kmh = max_wind.multiply(3.6)
            
            img_to_vis = wind_kmh.clip(moz)
            
            # Heatmap de velocidade do vento (km/h)
            vis_params = {
                'min': 50,
                'max': 200,
                'palette': ['#ffffcc', '#ffeda0', '#fed976', '#feb24c', '#fd8d3c', '#fc4e2a', '#e31a1c', '#bd0026', '#800026']
            }
            
            map_id_dict = img_to_vis.getMapId(vis_params)
            
        else:
            raise ValueError("layer_type deve ser 'rain' ou 'wind'")
            
        return {
            'mapid': map_id_dict['mapid'],
            'token': map_id_dict['token'],
            'tile_url': map_id_dict['tile_fetcher'].url_format,
            'start_date': start_date,
            'end_date': end_date,
            'type': layer_type
        }
        
    except Exception as e:
        raise Exception(f"Erro ao processar dados de ciclone no GEE: {e}")
