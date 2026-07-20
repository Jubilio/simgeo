from rest_framework import viewsets
from .models import AdministrativeBoundary, Infrastructure
from .serializers import AdministrativeBoundarySerializer, InfrastructureSerializer

class AdministrativeBoundaryViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Endpoint (apenas leitura) que lista Limites Administrativos.
    Pode filtrar por nível, ex: /api/boundaries/?level=1 (Para Províncias)
    """
    queryset = AdministrativeBoundary.objects.all()
    serializer_class = AdministrativeBoundarySerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        level = self.request.query_params.get('level', None)
        if level is not None:
            queryset = queryset.filter(level=level)
        return queryset


class InfrastructureViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Endpoint (apenas leitura) que lista Infraestruturas Críticas.
    Pode filtrar por tipo, ex: /api/infrastructures/?type=school
    """
    queryset = Infrastructure.objects.all()
    serializer_class = InfrastructureSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        infra_type = self.request.query_params.get('type', None)
        if infra_type is not None:
            queryset = queryset.filter(type=infra_type)
        return queryset
