from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
import time

class ChatbotView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        message = request.data.get('message', '')
        # mock sleep to simulate processing
        time.sleep(1)
        
        # Simple mock responses based on keywords
        response_text = "Sou o assistente de IA do SimGeo. No momento estou em versão de testes. Pode perguntar-me sobre locais e infraestruturas."
        
        lower_msg = message.lower()
        if 'hospital' in lower_msg or 'hospitais' in lower_msg:
            response_text = "Encontrei alguns hospitais na base de dados. Aqui tem as coordenadas para centrar o mapa."
            # We could return a structured payload for the frontend to center map
            return Response({
                "message": response_text,
                "action": {
                    "type": "flyTo",
                    "coordinates": [34.84, -19.83],
                    "zoom": 12
                }
            })
            
        elif 'buffer' in lower_msg:
            response_text = "Vou desenhar um buffer de 5km em redor das zonas de risco."
            return Response({
                "message": response_text,
                "action": {
                    "type": "createBuffer",
                    "coordinates": [34.84, -19.83],
                    "radius": 5
                }
            })
            
        return Response({
            "message": response_text
        })
