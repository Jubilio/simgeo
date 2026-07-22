import json
import urllib.request
from django.core.management.base import BaseCommand
from django.contrib.gis.geos import GEOSGeometry, MultiPolygon, Polygon
from maps.models import AdministrativeBoundary

ADM1_URL = "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/MOZ/ADM1/geoBoundaries-MOZ-ADM1.geojson"
ADM2_URL = "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/MOZ/ADM2/geoBoundaries-MOZ-ADM2.geojson"

class Command(BaseCommand):
    help = 'Importa os limites administrativos reais de Moçambique (Províncias e Distritos) via geoBoundaries.'

    def handle(self, *args, **options):
        self.stdout.write('A descarregar e processar limites de Moçambique...')
        
        # 1. Descarregar Províncias (ADM1)
        self.stdout.write('A descarregar Províncias (ADM1)...')
        req = urllib.request.Request(ADM1_URL, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as resp:
            data_adm1 = json.loads(resp.read().decode('utf-8'))
        
        provinces_count = 0
        province_map = {}

        for feature in data_adm1.get('features', []):
            props = feature.get('properties', {})
            name = props.get('shapeName', 'Desconhecido')
            code = props.get('shapeISO', props.get('shapeID', ''))
            
            geom_raw = GEOSGeometry(json.dumps(feature.get('geometry')))
            if isinstance(geom_raw, Polygon):
                geom = MultiPolygon(geom_raw)
            elif isinstance(geom_raw, MultiPolygon):
                geom = geom_raw
            else:
                continue

            boundary, created = AdministrativeBoundary.objects.update_or_create(
                name=name,
                level=AdministrativeBoundary.Level.PROVINCE,
                defaults={
                    'code': code,
                    'geometry': geom,
                }
            )
            province_map[name.lower()] = boundary
            provinces_count += 1

        self.stdout.write(self.style.SUCCESS(f'[OK] {provinces_count} Provincias importadas/atualizadas com sucesso!'))

        # 2. Descarregar Distritos (ADM2)
        self.stdout.write('A descarregar Distritos (ADM2)...')
        req2 = urllib.request.Request(ADM2_URL, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req2) as resp2:
            data_adm2 = json.loads(resp2.read().decode('utf-8'))

        districts_count = 0
        for feature in data_adm2.get('features', []):
            props = feature.get('properties', {})
            name = props.get('shapeName', 'Desconhecido')
            code = props.get('shapeID', '')

            geom_raw = GEOSGeometry(json.dumps(feature.get('geometry')))
            if isinstance(geom_raw, Polygon):
                geom = MultiPolygon(geom_raw)
            elif isinstance(geom_raw, MultiPolygon):
                geom = geom_raw
            else:
                continue

            AdministrativeBoundary.objects.update_or_create(
                name=name,
                level=AdministrativeBoundary.Level.DISTRICT,
                defaults={
                    'code': code,
                    'geometry': geom,
                }
            )
            districts_count += 1

        self.stdout.write(self.style.SUCCESS(f'[OK] {districts_count} Distritos importados/atualizados com sucesso!'))
