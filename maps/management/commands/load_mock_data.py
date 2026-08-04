from django.core.management.base import BaseCommand
from django.contrib.gis.geos import Polygon, MultiPolygon, Point
from maps.models import AdministrativeBoundary, Infrastructure


class Command(BaseCommand):
    help = 'Loads mock infrastructure data for testing (non-destructive).'

    def handle(self, *args, **kwargs):
        # Verificar se já existem infraestruturas
        if Infrastructure.objects.exists():
            self.stdout.write(self.style.WARNING('Infraestruturas já existem. A ignorar mock data.'))
            return

        self.stdout.write('A criar infraestruturas críticas de exemplo...')

        # Tentar usar o distrito da Beira real, ou criar um mínimo se não existir
        beira = AdministrativeBoundary.objects.filter(name__icontains='Beira').first()

        if not beira:
            self.stdout.write(self.style.WARNING('Distrito da Beira não encontrado. A criar geometria mínima...'))
            sofala = AdministrativeBoundary.objects.filter(name__icontains='Sofala').first()
            beira_poly = Polygon((
                (34.7, -19.9), (34.7, -19.7),
                (34.9, -19.7), (34.9, -19.9),
                (34.7, -19.9)
            ))
            beira = AdministrativeBoundary.objects.create(
                name='Beira',
                code='MZ-S-BEIRA',
                level=AdministrativeBoundary.Level.DISTRICT,
                parent=sofala,
                geometry=MultiPolygon(beira_poly),
                population=533825,
                area_km2=633.0
            )

        infrastructures = [
            {
                'name': 'Hospital Central da Beira',
                'type': Infrastructure.Type.HOSPITAL,
                'lon': 34.8389, 'lat': -19.8236,
                'capacity': 800, 'condition': 'Boa'
            },
            {
                'name': 'Escola Secundária Samora Machel',
                'type': Infrastructure.Type.SCHOOL,
                'lon': 34.8450, 'lat': -19.8300,
                'capacity': 1200, 'condition': 'Razoável'
            },
            {
                'name': 'Ponto de Água - Macuti',
                'type': Infrastructure.Type.WATER_POINT,
                'lon': 34.8500, 'lat': -19.8400,
                'capacity': 100, 'condition': 'Boa'
            },
            {
                'name': 'Mercado Central da Beira',
                'type': Infrastructure.Type.MARKET,
                'lon': 34.8410, 'lat': -19.8250,
                'capacity': 500, 'condition': 'Razoável'
            },
            {
                'name': 'Ponte Pungué',
                'type': Infrastructure.Type.BRIDGE,
                'lon': 34.7900, 'lat': -19.8100,
                'capacity': None, 'condition': 'Boa'
            },
        ]

        for infra in infrastructures:
            Infrastructure.objects.get_or_create(
                name=infra['name'],
                defaults={
                    'type': infra['type'],
                    'district': beira,
                    'geometry': Point(infra['lon'], infra['lat']),
                    'capacity': infra['capacity'],
                    'condition': infra['condition'],
                }
            )

        self.stdout.write(self.style.SUCCESS(f'{len(infrastructures)} infraestruturas criadas com sucesso!'))
