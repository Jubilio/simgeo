from django.contrib.gis.db import models
from django.utils.translation import gettext_lazy as _
from maps.models import AdministrativeBoundary


class Scenario(models.Model):
    """Cenário de simulação criado pelo utilizador."""

    class HazardType(models.TextChoices):
        FLOOD = 'flood', _('Cheia')
        CYCLONE = 'cyclone', _('Ciclone')
        DROUGHT = 'drought', _('Seca')
        MULTI = 'multi', _('Multi-Risco')

    class Status(models.TextChoices):
        PENDING = 'pending', _('Pendente')
        RUNNING = 'running', _('A Processar')
        COMPLETED = 'completed', _('Concluído')
        FAILED = 'failed', _('Falhado')

    name = models.CharField(max_length=255, verbose_name=_('Nome do Cenário'))
    description = models.TextField(blank=True, verbose_name=_('Descrição'))
    hazard_type = models.CharField(max_length=20, choices=HazardType.choices, verbose_name=_('Tipo de Risco'))
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)

    # Área de estudo
    area_of_interest = models.PolygonField(srid=4326, null=True, blank=True, verbose_name=_('Área de Interesse'))
    affected_districts = models.ManyToManyField(AdministrativeBoundary, blank=True, verbose_name=_('Distritos Afetados'))

    # Parâmetros do cenário (armazenados em JSON)
    parameters = models.JSONField(default=dict, verbose_name=_('Parâmetros'))

    # Resultados
    results = models.JSONField(default=dict, verbose_name=_('Resultados'))
    result_geometry = models.GeometryField(srid=4326, null=True, blank=True, verbose_name=_('Geometria Resultado'))

    created_by = models.ForeignKey(
        'auth.User', on_delete=models.SET_NULL, null=True,
        related_name='scenarios', verbose_name=_('Criado por')
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _('Cenário')
        verbose_name_plural = _('Cenários')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.get_hazard_type_display()})"


class FloodParameters(models.Model):
    """Parâmetros específicos para simulação de cheias."""
    scenario = models.OneToOneField(Scenario, on_delete=models.CASCADE, related_name='flood_params')
    rainfall_mm = models.FloatField(verbose_name=_('Precipitação (mm)'))
    duration_hours = models.IntegerField(default=24, verbose_name=_('Duração (horas)'))
    return_period_years = models.IntegerField(default=10, verbose_name=_('Período de Retorno (anos)'))
    river_flow_m3s = models.FloatField(null=True, blank=True, verbose_name=_('Caudal (m³/s)'))

    class Meta:
        verbose_name = _('Parâmetros de Cheia')


class CycloneParameters(models.Model):
    """Parâmetros específicos para simulação de ciclones."""
    scenario = models.OneToOneField(Scenario, on_delete=models.CASCADE, related_name='cyclone_params')
    category = models.IntegerField(verbose_name=_('Categoria (1-5)'))
    wind_speed_kmh = models.FloatField(verbose_name=_('Velocidade do Vento (km/h)'))
    rainfall_mm = models.FloatField(verbose_name=_('Precipitação (mm)'))
    storm_surge_m = models.FloatField(default=0, verbose_name=_('Surge de Tempestade (m)'))
    track_geometry = models.LineStringField(srid=4326, null=True, blank=True, verbose_name=_('Trajetória'))

    class Meta:
        verbose_name = _('Parâmetros de Ciclone')
