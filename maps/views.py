import json
import os
import tempfile
import zipfile
from pathlib import Path

from django.contrib.gis.gdal import DataSource, GDALException
from django.contrib.gis.geos import GEOSGeometry
from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AdministrativeBoundary, Infrastructure, SpatialDataset
from .serializers import AdministrativeBoundarySerializer, InfrastructureSerializer
from .upload_utils import find_single_shapefile, safely_extract_zip


MAX_UPLOAD_BYTES = 50 * 1024 * 1024
SUPPORTED_UPLOAD_EXTENSIONS = {".zip", ".geojson", ".json"}
SUPPORTED_LAYER_TYPES = {"infrastructure"}


class AdministrativeBoundaryViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Endpoint (apenas leitura) que lista Limites Administrativos.
    Pode filtrar por nível, ex: /api/boundaries/?level=1 (Para Províncias)
    """

    queryset = AdministrativeBoundary.objects.all()
    serializer_class = AdministrativeBoundarySerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        level = self.request.query_params.get("level")
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
        infrastructure_type = self.request.query_params.get("type")
        if infrastructure_type is not None:
            queryset = queryset.filter(type=infrastructure_type)
        search = self.request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(name__icontains=search[:100])
        return queryset


def _delete_failed_dataset(dataset):
    if not dataset:
        return
    dataset.file.delete(save=False)
    dataset.delete()


def _normalized_properties(feature):
    properties = {field: feature.get(field) for field in feature.fields}
    # OGR may return date/list objects that a JSONField cannot serialize.
    return json.loads(json.dumps(properties, default=str))


def _feature_geometry_wgs84(feature, assume_wgs84=False):
    geometry = feature.geom
    if geometry is None:
        raise ValueError("Foi encontrada uma feição sem geometria.")

    if geometry.srid is None:
        if not assume_wgs84:
            raise ValueError(
                "O Shapefile não possui CRS identificável. Inclua um ficheiro .prj."
            )
        geometry.srid = 4326

    if geometry.srid != 4326:
        try:
            geometry.transform(4326)
        except GDALException as exc:
            raise ValueError(
                f"Não foi possível reprojetar a geometria para EPSG:4326: {exc}"
            ) from exc

    return GEOSGeometry(geometry.wkt, srid=4326)


def _import_infrastructure(data_path, assume_wgs84=False):
    try:
        data_source = DataSource(str(data_path))
        layer = data_source[0]
    except (GDALException, IndexError) as exc:
        raise ValueError(f"GDAL não conseguiu abrir o ficheiro espacial: {exc}") from exc

    imported_count = 0
    name_keys = ("name", "Name", "NAME", "nome", "Nome", "NOME", "desc", "descricao")
    type_keys = ("type", "Type", "TYPE", "tipo", "Tipo", "TIPO")

    with transaction.atomic():
        for feature in layer:
            properties = _normalized_properties(feature)
            raw_name = next(
                (properties[key] for key in name_keys if properties.get(key)),
                "Desconhecido",
            )
            raw_type = next(
                (properties[key] for key in type_keys if properties.get(key)),
                "other",
            )
            Infrastructure.objects.create(
                name=str(raw_name)[:255],
                type=str(raw_type).lower()[:20],
                geometry=_feature_geometry_wgs84(feature, assume_wgs84),
                properties=properties,
            )
            imported_count += 1

    return imported_count


class FileUploadView(APIView):
    """Upload one Shapefile ZIP or GeoJSON and import infrastructure features."""

    parser_classes = (MultiPartParser,)
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, *args, **kwargs):
        file_obj = request.FILES.get("file")
        layer_type = request.data.get("layer_type", "infrastructure")

        if not file_obj:
            return Response(
                {"error": "Nenhum ficheiro enviado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        extension = os.path.splitext(file_obj.name)[1].lower()
        if extension not in SUPPORTED_UPLOAD_EXTENSIONS:
            return Response(
                {
                    "error": (
                        f"Formato não suportado ({extension}). Envie um .zip com "
                        "um Shapefile ou um ficheiro .geojson."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        if layer_type not in SUPPORTED_LAYER_TYPES:
            return Response(
                {"error": "layer_type suportado nesta versão: infrastructure."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if file_obj.size > MAX_UPLOAD_BYTES:
            return Response(
                {"error": "O ficheiro excede o limite de 50 MB."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        dataset = None
        try:
            dataset = SpatialDataset.objects.create(
                name=file_obj.name,
                file=file_obj,
                layer_type=layer_type,
            )

            with tempfile.TemporaryDirectory() as temporary_directory:
                if extension == ".zip":
                    safely_extract_zip(dataset.file.path, temporary_directory)
                    data_path = find_single_shapefile(temporary_directory)
                    assume_wgs84 = False
                else:
                    data_path = Path(dataset.file.path)
                    assume_wgs84 = True

                imported_count = _import_infrastructure(
                    data_path,
                    assume_wgs84=assume_wgs84,
                )

            return Response(
                {"message": f"{imported_count} infraestruturas importadas com sucesso!"}
            )
        except (ValueError, zipfile.BadZipFile, GDALException) as exc:
            _delete_failed_dataset(dataset)
            return Response(
                {"error": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as exc:
            _delete_failed_dataset(dataset)
            return Response(
                {"error": f"Erro a processar ficheiro espacial: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
