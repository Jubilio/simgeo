from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework.response import Response
from rest_framework.views import APIView
from maps.views import AdministrativeBoundaryViewSet, InfrastructureViewSet
from simulation.views import GEEFloodSimulationView

router = DefaultRouter()
router.register(r'boundaries', AdministrativeBoundaryViewSet, basename='boundary')
router.register(r'infrastructures', InfrastructureViewSet, basename='infrastructure')

class APIRootView(APIView):
    """
    SimGeo API Root
    """
    def get(self, request, format=None):
        return Response({
            'platform': 'SimGeo - Spatial Decision Support System',
            'version': '1.0',
            'endpoints': {
                'boundaries': request.build_absolute_uri('boundaries/'),
                'infrastructures': request.build_absolute_uri('infrastructures/'),
                'simulation_gee_flood': request.build_absolute_uri('simulation/gee/flood/'),
            }
        })

urlpatterns = [
    path('', APIRootView.as_view(), name='api-root'),
    path('simulation/gee/flood/', GEEFloodSimulationView.as_view(), name='gee-flood'),
    path('', include(router.urls)),
]
