from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .services.gee_service import get_flood_simulation_tiles

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
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
