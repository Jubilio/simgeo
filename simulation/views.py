from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .services.gee_service import get_flood_simulation_tiles, get_lulc_tiles, get_lithology_tiles, get_groundwater_tiles, get_groundwater_timeseries

class GEEFloodSimulationView(APIView):
    """
    Endpoint para gerar a camada (Tile Layer) de inundação no GEE
    com base num parâmetro de water_level (metros).
    """

    def get(self, request):
        try:
            # Obtém o nível de água (default: 2.0 metros)
            water_level_str = request.query_params.get('water_level', '2.0')
            water_level = float(water_level_str)
            
            # Chama o serviço GEE
            gee_data = get_flood_simulation_tiles(water_level=water_level)
            
            return Response({
                'status': 'success',
                'water_level': water_level,
                'gee_layer': gee_data
            })
            
        except ValueError:
            return Response(
                {'error': 'Parâmetro water_level inválido. Deve ser numérico.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            error_msg = str(e)
            if "not initialized" in error_msg.lower() or "authorize" in error_msg.lower():
                return Response(
                    {
                        'error': 'Google Earth Engine não autenticado no servidor local.',
                        'detail': 'Por favor execute `.\\venv\\Scripts\\earthengine authenticate` no terminal PowerShell.'
                    }, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            return Response(
                {'error': error_msg}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class GEELULCView(APIView):
    """
    Endpoint para obter os tiles de Land Use / Land Cover (LULC).
    """
    def get(self, request):
        try:
            gee_data = get_lulc_tiles()
            return Response({
                'status': 'success',
                'gee_layer': gee_data
            })
        except Exception as e:
            error_msg = str(e)
            if "not initialized" in error_msg.lower() or "authorize" in error_msg.lower():
                return Response(
                    {
                        'error': 'Google Earth Engine não autenticado no servidor local.',
                        'detail': 'Por favor execute `.\\venv\\Scripts\\earthengine authenticate` no terminal PowerShell.'
                    }, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            return Response(
                {'error': error_msg}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class GEELithologyView(APIView):
    """
    Endpoint para obter os tiles de Análise Litológica ASTER.
    """
    def get(self, request):
        try:
            mineral_type = request.query_params.get('mineral_type', 'kaolinite')
            gee_data = get_lithology_tiles(mineral_type=mineral_type)
            return Response({
                'status': 'success',
                'mineral_type': mineral_type,
                'gee_layer': gee_data
            })
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            error_msg = str(e)
            if "not initialized" in error_msg.lower() or "authorize" in error_msg.lower():
                return Response(
                    {'error': 'Google Earth Engine não autenticado no servidor local.'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            return Response(
                {'error': error_msg}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class GEEGroundwaterMapView(APIView):
    """
    Endpoint para obter os tiles mensais de Águas Subterrâneas (GLDAS).
    """
    def get(self, request):
        try:
            year = int(request.query_params.get('year', 2023))
            month = int(request.query_params.get('month', 1))
            gee_data = get_groundwater_tiles(year=year, month=month)
            return Response({
                'status': 'success',
                'year': year,
                'month': month,
                'gee_layer': gee_data
            })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class GEEGroundwaterTimeseriesView(APIView):
    """
    Endpoint POST para extrair a série temporal agregada de Águas Subterrâneas.
    """
    def post(self, request):
        try:
            start_date = request.data.get('start_date', '2023-01-01')
            end_date = request.data.get('end_date', '2023-12-31')
            points = request.data.get('points', [])
            
            timeseries = get_groundwater_timeseries(start_date, end_date, points)
            
            return Response({
                'status': 'success',
                'timeseries': timeseries
            })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
