from django.contrib.gis.db import models
from django.utils.translation import gettext_lazy as _


class AdministrativeBoundary(models.Model):
    """Limites administrativos: Províncias, Distritos, Postos, Localidades."""

    class Level(models.IntegerChoices):
        PROVINCE = 1, _('Província')
        DISTRICT = 2, _('Distrito')
        ADMIN_POST = 3, _('Posto Administrativo')
        LOCALITY = 4, _('Localidade')

    name = models.CharField(max_length=255, verbose_name=_('Nome'))
    code = models.CharField(max_length=50, blank=True, null=True, verbose_name=_('Código'))
    level = models.IntegerField(choices=Level.choices, verbose_name=_('Nível'))
    parent = models.ForeignKey(
        'self', on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='children',
        verbose_name=_('Unidade Pai')
    )
    geometry = models.MultiPolygonField(srid=4326, verbose_name=_('Geometria'))
    population = models.IntegerField(null=True, blank=True, verbose_name=_('População'))
    area_km2 = models.FloatField(null=True, blank=True, verbose_name=_('Área (km²)'))
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _('Limite Administrativo')
        verbose_name_plural = _('Limites Administrativos')
        ordering = ['level', 'name']

    def __str__(self):
        return f"{self.get_level_display()} - {self.name}"


class Infrastructure(models.Model):
    """Infraestrutura crítica: escolas, hospitais, estradas, pontes."""

    class Type(models.TextChoices):
        SCHOOL = 'school', _('Escola')
        HOSPITAL = 'hospital', _('Hospital / Centro de Saúde')
        ROAD = 'road', _('Estrada')
        BRIDGE = 'bridge', _('Ponte')
        MARKET = 'market', _('Mercado')
        WATER_POINT = 'water', _('Ponto de Água')

    name = models.CharField(max_length=255, verbose_name=_('Nome'))
    type = models.CharField(max_length=20, choices=Type.choices, verbose_name=_('Tipo'))
    geometry = models.GeometryField(srid=4326, verbose_name=_('Geometria'))
    district = models.ForeignKey(
        AdministrativeBoundary, on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='infrastructure',
        verbose_name=_('Distrito')
    )
    capacity = models.IntegerField(null=True, blank=True, verbose_name=_('Capacidade'))
    condition = models.CharField(max_length=50, blank=True, verbose_name=_('Estado'))
    properties = models.JSONField(default=dict, blank=True, verbose_name=_('Propriedades Extras'))
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _('Infraestrutura')
        verbose_name_plural = _('Infraestruturas')

    def __str__(self):
        return f"{self.get_type_display()} - {self.name}"


class SocioeconomicData(models.Model):
    """Dados socioeconómicos por unidade administrativa."""

    boundary = models.OneToOneField(
        AdministrativeBoundary, on_delete=models.CASCADE,
        related_name='socioeconomic',
        verbose_name=_('Limite Administrativo')
    )
    poverty_rate = models.FloatField(null=True, blank=True, verbose_name=_('Taxa de Pobreza (%)'))
    food_insecurity_rate = models.FloatField(null=True, blank=True, verbose_name=_('Insegurança Alimentar (%)'))
    population_female = models.IntegerField(null=True, blank=True, verbose_name=_('Pop. Feminina'))
    population_children = models.IntegerField(null=True, blank=True, verbose_name=_('Pop. Crianças'))
    population_elderly = models.IntegerField(null=True, blank=True, verbose_name=_('Pop. Idosos'))
    population_disabled = models.IntegerField(null=True, blank=True, verbose_name=_('Pop. com Deficiência'))
    ipc_phase = models.IntegerField(null=True, blank=True, verbose_name=_('Fase IPC'))
    year = models.IntegerField(verbose_name=_('Ano'))
    source = models.CharField(max_length=255, blank=True, verbose_name=_('Fonte'))
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _('Dado Socioeconómico')
        verbose_name_plural = _('Dados Socioeconómicos')

    def __str__(self):
        return f"{self.boundary.name} - {self.year}"
