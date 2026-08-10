from rest_framework import viewsets
from .models import AdministrativeBoundary, Infrastructure, SpatialDataset
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

import os
import zipfile
import tempfile
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser
from rest_framework import status
from django.contrib.gis.gdal import DataSource
from django.contrib.gis.geos import GEOSGeometry

from rest_framework.permissions import AllowAny

class FileUploadView(APIView):
    """
    Endpoint para Administradores carregarem ficheiros geográficos (.zip shapefile ou .geojson)
    e popularem as tabelas do PostGIS automaticamente.
    """
    parser_classes = (MultiPartParser,)
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, *args, **kwargs):
        file_obj = request.FILES.get('file')
        layer_type = request.data.get('layer_type', 'infrastructure')
        
        if not file_obj:
            return Response({"error": "Nenhum ficheiro enviado."}, status=status.HTTP_400_BAD_REQUEST)
            
        ext = os.path.splitext(file_obj.name)[1].lower()
        
        # Guardar ficheiro físico na base de dados
        dataset = SpatialDataset.objects.create(
            name=file_obj.name,
            file=file_obj,
            layer_type=layer_type
        )
        
        with tempfile.TemporaryDirectory() as tmpdir:
            # Usar o ficheiro gravado
            file_path = dataset.file.path
            
            # Se for ZIP (Shapefile)
            if ext == '.zip':
                with zipfile.ZipFile(file_path, 'r') as zip_ref:
                    zip_ref.extractall(tmpdir)
                
                shp_files = [f for f in os.listdir(tmpdir) if f.endswith('.shp')]
                if not shp_files:
                    return Response({"error": "Nenhum ficheiro .shp encontrado no ZIP."}, status=status.HTTP_400_BAD_REQUEST)
                data_path = os.path.join(tmpdir, shp_files[0])
            # Se for GeoJSON
            elif ext in ['.geojson', '.json']:
                data_path = file_path
            else:
                return Response({"error": f"Formato não suportado ({ext}). Envie um .zip (com o Shapefile dentro) ou um ficheiro .geojson."}, status=status.HTTP_400_BAD_REQUEST)
                
            try:
                ds = DataSource(data_path)
                layer = ds[0]
                
                imported_count = 0
                for feature in layer:
                    geom = feature.geom
                    
                    if geom.srid != 4326 and geom.srid is not None:
                        try:
                            geom.transform(4326)
                        except Exception:
                            pass # Pode falhar se não houver PROJ configurado, mas assumimos WGS84
                            
                    geos_geom = GEOSGeometry(geom.wkt, srid=4326)
                    
                    properties = {}
                    for field in feature.fields:
                        properties[field] = feature.get(field)
                        
                    # Mapeamento Básico de Nomes
                    name_keys = ['name', 'Name', 'NAME', 'nome', 'Nome', 'NOME', 'desc', 'descricao']
                    type_keys = ['type', 'Type', 'TYPE', 'tipo', 'Tipo', 'TIPO']
                    
                    name = next((properties[k] for k in name_keys if k in properties), 'Desconhecido')
                    infra_type = next((properties[k] for k in type_keys if k in properties), 'other')
                    
                    if layer_type == 'infrastructure':
                        Infrastructure.objects.create(
                            name=str(name)[:255],
                            type=str(infra_type).lower()[:20],
                            geometry=geos_geom,
                            properties=properties
                        )
                        imported_count += 1
                        
                return Response({"message": f"{imported_count} infraestruturas importadas com sucesso!"})
                
            except Exception as e:
                return Response({"error": f"Erro a processar ficheiro espacial: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

