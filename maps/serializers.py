from rest_framework import serializers
from rest_framework_gis.serializers import GeoFeatureModelSerializer
from .models import AdministrativeBoundary, Infrastructure

class AdministrativeBoundarySerializer(GeoFeatureModelSerializer):
    """Serializer que expõe limites administrativos como FeatureCollection GeoJSON."""
    level_display = serializers.CharField(source='get_level_display', read_only=True)

    class Meta:
        model = AdministrativeBoundary
        geo_field = 'geometry'
        fields = ('id', 'name', 'code', 'level', 'level_display', 'population', 'area_km2')


class InfrastructureSerializer(GeoFeatureModelSerializer):
    """Serializer que expõe infraestruturas como FeatureCollection GeoJSON."""
    type_display = serializers.CharField(source='get_type_display', read_only=True)

    class Meta:
        model = Infrastructure
        geo_field = 'geometry'
        fields = ('id', 'name', 'type', 'type_display', 'capacity', 'condition', 'properties')
