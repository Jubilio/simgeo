from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework.response import Response
from rest_framework.views import APIView
from maps.views import AdministrativeBoundaryViewSet, InfrastructureViewSet

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
            }
        })

urlpatterns = [
    path('', APIRootView.as_view(), name='api-root'),
    path('', include(router.urls)),
]
