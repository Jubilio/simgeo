from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

from .services.gee_service import (
    get_flood_simulation_tiles,
    get_groundwater_tiles,
    get_groundwater_timeseries,
    get_lithology_tiles,
    get_lulc_tiles,
)
from .services.malaria_service import (
    DEFAULT_END_YEAR,
    DEFAULT_MONTH,
    DEFAULT_START_YEAR,
    get_malaria_suitability_tiles,
)
from .services.gaul_service import get_gaul_admin_tiles
from .services.cyclone_service import get_cyclone_tiles

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
    permission_classes = [AllowAny]
    authentication_classes = []
    
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


class GEEMalariaSuitabilityView(APIView):
    """Serve the environmental malaria suitability layer for Mozambique."""

    def get(self, request):
        try:
            start_year = request.query_params.get("start_year", DEFAULT_START_YEAR)
            end_year = request.query_params.get("end_year", DEFAULT_END_YEAR)
            month = request.query_params.get("month", DEFAULT_MONTH)
            gee_data = get_malaria_suitability_tiles(
                start_year=start_year,
                end_year=end_year,
                month=month,
            )
            return Response({
                "status": "success",
                "gee_layer": gee_data,
            })
        except (TypeError, ValueError) as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            error_message = str(exc)
            if "inicializado" in error_message.lower() or "autentic" in error_message.lower():
                return Response(
                    {
                        "error": "Google Earth Engine não autenticado no servidor.",
                        "detail": error_message,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            return Response(
                {"error": error_message},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class GEEAdminBoundariesView(APIView):
    """
    Serve limites administrativos FAO GAUL 2015 via GEE.
    Suporta level1 (Províncias) e level2 (Distritos).
    Permite filtrar por nome e por país.
    
    Parâmetros:
        level       : 'level1' | 'level2'  (default: level1)
        name_filter : string parcial para filtrar pelo nome do admin
        country     : nome do país em inglês (default: Mozambique)
    """

    def get(self, request):
        level = request.query_params.get('level', 'level1')
        name_filter = request.query_params.get('name_filter', '')
        country = request.query_params.get('country', 'Mozambique')

        try:
            gee_data = get_gaul_admin_tiles(
                level=level,
                name_filter=name_filter,
                country_filter=country,
            )
            return Response({'status': 'success', 'gee_layer': gee_data})

        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            error_msg = str(e)
            if 'inicializado' in error_msg.lower() or 'autenti' in error_msg.lower():
                return Response(
                    {'error': 'Google Earth Engine não autenticado.', 'detail': error_msg},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            return Response({'error': error_msg}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class GEECycloneView(APIView):
    def get(self, request):
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        layer_type = request.query_params.get('type', 'rain')
        
        if not start_date or not end_date:
            return Response({"error": "start_date e end_date são obrigatórios."}, status=400)
            
        try:
            layer_data = get_cyclone_tiles(start_date, end_date, layer_type)
            return Response({"status": "success", "gee_layer": layer_data})
        except Exception as e:
            return Response({"error": str(e)}, status=500)
