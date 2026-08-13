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
    - 'rain': Precipitação máxima diária (GPM IMERG Daily)
    - 'wind': Máxima velocidade do vento (ERA5 Daily, componentes U+V)
    """
    if not initialize_gee():
        raise Exception("Google Earth Engine não pôde ser inicializado.")

    # Validar intervalo de datas (máx 30 dias para não travar o servidor)
    import datetime
    try:
        d_start = datetime.date.fromisoformat(start_date)
        d_end = datetime.date.fromisoformat(end_date)
        if (d_end - d_start).days > 30:
            raise ValueError("O intervalo máximo permitido é de 30 dias.")
        if d_end < d_start:
            raise ValueError("A data de início deve ser anterior à data de fim.")
    except ValueError as ve:
        raise ve

    moz = get_mozambique_geometry()
    
    try:
        # Converter datas para ee.Date
        # O GEE filterDate é exclusivo no endDate, então adicionamos 1 dia para cobrir o último dia.
        start = ee.Date(start_date)
        end = ee.Date(end_date).advance(1, 'day')
        
        if layer_type == 'rain':
            # GPM IMERG V06 (30-min) -> .max() evita sum() sobre 100+ imagens e é mais rápido
            dataset = ee.ImageCollection('NASA/GPM_L3/IMERG_V06') \
                .filterDate(start, end) \
                .select('precipitationCal')
            
            # Pico de precipitação (mm/h) no período — representa a intensidade máxima da chuva
            peak_rain = dataset.max()
            img_to_vis = peak_rain.clip(moz)
            
            vis_params = {
                'min': 5,
                'max': 50,
                'palette': ['#e0f3db', '#a8ddb5', '#4eb3d3', '#2b8cbe', '#0868ac', '#084081', '#ffc107', '#ff5722', '#b30000']
            }
            
            map_id_dict = img_to_vis.getMapId(vis_params)
            
        elif layer_type == 'wind':
            # ECMWF ERA5 Daily Aggregates - Não tem gust, vamos calcular velocidade média
            dataset = ee.ImageCollection('ECMWF/ERA5/DAILY') \
                .filterDate(start, end)
            
            def calc_wind_speed(img):
                u = img.select('u_component_of_wind_10m')
                v = img.select('v_component_of_wind_10m')
                ws = u.pow(2).add(v.pow(2)).sqrt().rename('wind_speed')
                return img.addBands(ws)
                
            # Máximo absoluto durante o período
            max_wind = dataset.map(calc_wind_speed).select('wind_speed').max()
            
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
