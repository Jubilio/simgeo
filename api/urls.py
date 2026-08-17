from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework.response import Response
from rest_framework.views import APIView
from maps.views import AdministrativeBoundaryViewSet, InfrastructureViewSet, FileUploadView
from simulation.views import (
    AdminBaselineView,
    GEEFloodSimulationView,
    GEEGroundwaterMapView,
    GEEGroundwaterTimeseriesView,
    GEELithologyView,
    GEELULCView,
    GEEMalariaSuitabilityView,
    GEEAdminBoundariesView,
    GEECycloneView,
    GEEForestDynamicsView,
    GEELivestockDynamicsView,
    GEEFloodImpactView,
    GoogleFloodForecastView,
    GoogleFloodStatusView,
)

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
                'simulation_gee_lulc': request.build_absolute_uri('simulation/gee/lulc/'),
                'simulation_gee_lithology': request.build_absolute_uri('simulation/gee/lithology/'),
                'simulation_gee_groundwater_map': request.build_absolute_uri('simulation/gee/groundwater/map/'),
                'simulation_gee_groundwater_ts': request.build_absolute_uri('simulation/gee/groundwater/timeseries/'),
                'simulation_gee_malaria_suitability': request.build_absolute_uri('simulation/gee/malaria-suitability/'),
                'simulation_gee_admin_boundaries': request.build_absolute_uri('simulation/gee/admin-boundaries/'),
                'admin_baseline': request.build_absolute_uri('simulation/admin-baseline/'),
                'simulation_gee_cyclone': request.build_absolute_uri('simulation/gee/cyclone/'),
                'simulation_gee_flood_impact': request.build_absolute_uri('simulation/gee/flood-impact/'),
                'google_flood_status': request.build_absolute_uri('simulation/google-floods/status/'),
                'google_flood_forecast': request.build_absolute_uri('simulation/google-floods/forecast/'),
                'simulation_gee_forest_dynamics': request.build_absolute_uri('simulation/gee/forest-dynamics/'),
                'simulation_gee_livestock_dynamics': request.build_absolute_uri('simulation/gee/livestock-dynamics/'),
            }
        })

urlpatterns = [
    path('', APIRootView.as_view(), name='api-root'),
    path('simulation/gee/flood/', GEEFloodSimulationView.as_view(), name='gee-flood'),
    path('simulation/gee/lulc/', GEELULCView.as_view(), name='gee-lulc'),
    path('simulation/gee/lithology/', GEELithologyView.as_view(), name='gee-lithology'),
    path('simulation/gee/groundwater/map/', GEEGroundwaterMapView.as_view(), name='gee-groundwater-map'),
    path('simulation/gee/groundwater/timeseries/', GEEGroundwaterTimeseriesView.as_view(), name='gee-groundwater-ts'),
    path('simulation/gee/malaria-suitability/', GEEMalariaSuitabilityView.as_view(), name='gee-malaria-suitability'),
    path('simulation/gee/admin-boundaries/', GEEAdminBoundariesView.as_view(), name='gee-admin-boundaries'),
    path('simulation/admin-baseline/', AdminBaselineView.as_view(), name='admin-baseline'),
    path('simulation/gee/cyclone/', GEECycloneView.as_view(), name='gee-cyclone'),
    path('simulation/gee/flood-impact/', GEEFloodImpactView.as_view(), name='gee-flood-impact'),
    path('simulation/google-floods/status/', GoogleFloodStatusView.as_view(), name='google-flood-status'),
    path('simulation/google-floods/forecast/', GoogleFloodForecastView.as_view(), name='google-flood-forecast'),
    path('simulation/gee/forest-dynamics/', GEEForestDynamicsView.as_view(), name='gee-forest-dynamics'),
    path('simulation/gee/livestock-dynamics/', GEELivestockDynamicsView.as_view(), name='gee-livestock-dynamics'),
    path('upload/', FileUploadView.as_view(), name='maps-upload'),
    path('agent/', include('ai_agent.urls')),
    path('', include(router.urls)),
]
