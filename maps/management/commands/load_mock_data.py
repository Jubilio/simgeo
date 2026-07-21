from django.core.management.base import BaseCommand
from django.contrib.gis.geos import Polygon, MultiPolygon, Point
from maps.models import AdministrativeBoundary, Infrastructure

class Command(BaseCommand):
    help = 'Loads mock GeoJSON data for testing the SimGeo API.'

    def handle(self, *args, **kwargs):
        self.stdout.write('Limpar dados existentes...')
        AdministrativeBoundary.objects.all().delete()
        Infrastructure.objects.all().delete()

        self.stdout.write('Criar dados fictícios de Limites Administrativos (Sofala)...')
        
        # Um quadrado grosseiro representando a Província de Sofala
        sofala_poly = Polygon((
            (33.5, -21.5),
            (33.5, -17.5),
            (36.0, -17.5),
            (36.0, -21.5),
            (33.5, -21.5)
        ))
        sofala_geom = MultiPolygon(sofala_poly)

        sofala = AdministrativeBoundary.objects.create(
            name='Sofala',
            code='MZ-S',
            level=AdministrativeBoundary.Level.PROVINCE,
            geometry=sofala_geom,
            population=2221803,
            area_km2=68018.0
        )

        # Distrito da Beira
        beira_poly = Polygon((
            (34.7, -19.9),
            (34.7, -19.7),
            (34.9, -19.7),
            (34.9, -19.9),
            (34.7, -19.9)
        ))
        beira_geom = MultiPolygon(beira_poly)
        
        beira = AdministrativeBoundary.objects.create(
            name='Beira',
            code='MZ-S-BEIRA',
            level=AdministrativeBoundary.Level.DISTRICT,
            parent=sofala,
            geometry=beira_geom,
            population=533825,
            area_km2=633.0
        )

        self.stdout.write('Criar infraestruturas críticas na Beira...')
        
        infrastructures = [
            {
                'name': 'Hospital Central da Beira',
                'type': Infrastructure.Type.HOSPITAL,
                'lon': 34.8389,
                'lat': -19.8236,
                'capacity': 800,
                'condition': 'Boa'
            },
            {
                'name': 'Escola Secundária Samora Machel',
                'type': Infrastructure.Type.SCHOOL,
                'lon': 34.8450,
                'lat': -19.8300,
                'capacity': 1200,
                'condition': 'Razoável'
            },
            {
                'name': 'Ponto de Água - Macuti',
                'type': Infrastructure.Type.WATER_POINT,
                'lon': 34.8500,
                'lat': -19.8400,
                'capacity': 100,
                'condition': 'Boa'
            }
        ]

        for infra in infrastructures:
            Infrastructure.objects.create(
                name=infra['name'],
                type=infra['type'],
                district=beira,
                geometry=Point(infra['lon'], infra['lat']),
                capacity=infra['capacity'],
                condition=infra['condition']
            )

        self.stdout.write(self.style.SUCCESS('Mock data criado com sucesso!'))
