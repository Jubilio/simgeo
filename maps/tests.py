import json
import shutil
import tempfile
from unittest.mock import patch

from django.contrib.auth.models import Permission, User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from maps.models import Infrastructure, SpatialDataset


UPLOAD_URL = "/api/upload/"


def _geojson_upload():
    payload = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"nome": "Escola Primária da Beira", "tipo": "school"},
                "geometry": {"type": "Point", "coordinates": [34.84, -19.83]},
            }
        ],
    }
    return SimpleUploadedFile(
        "escolas.geojson",
        json.dumps(payload).encode("utf-8"),
        content_type="application/geo+json",
    )


class FileUploadPermissionTests(TestCase):
    """Regression: /api/upload/ used to accept anonymous writes to PostGIS."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls._media_root = tempfile.mkdtemp()
        cls._media_override = override_settings(MEDIA_ROOT=cls._media_root)
        cls._media_override.enable()

    @classmethod
    def tearDownClass(cls):
        cls._media_override.disable()
        shutil.rmtree(cls._media_root, ignore_errors=True)
        super().tearDownClass()

    def setUp(self):
        self.client = APIClient()

    def _authorized_user(self):
        user = User.objects.create_user("importer", password="pass")
        user.user_permissions.add(
            Permission.objects.get(codename="add_spatialdataset"),
            Permission.objects.get(codename="add_infrastructure"),
        )
        return user

    def test_anonymous_upload_is_rejected_without_side_effects(self):
        response = self.client.post(
            UPLOAD_URL,
            {"file": _geojson_upload(), "layer_type": "infrastructure"},
            format="multipart",
        )

        self.assertIn(response.status_code, {401, 403})
        self.assertFalse(SpatialDataset.objects.exists())
        self.assertFalse(Infrastructure.objects.exists())

    def test_authenticated_user_without_permission_is_rejected(self):
        self.client.force_authenticate(User.objects.create_user("viewer", password="pass"))

        response = self.client.post(
            UPLOAD_URL,
            {"file": _geojson_upload(), "layer_type": "infrastructure"},
            format="multipart",
        )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(SpatialDataset.objects.exists())
        self.assertFalse(Infrastructure.objects.exists())

    def test_session_upload_requires_csrf_token(self):
        csrf_client = APIClient(enforce_csrf_checks=True)
        csrf_client.force_login(self._authorized_user())

        response = csrf_client.post(
            UPLOAD_URL,
            {"file": _geojson_upload(), "layer_type": "infrastructure"},
            format="multipart",
        )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(Infrastructure.objects.exists())

    def test_authorized_user_imports_geojson(self):
        self.client.force_authenticate(self._authorized_user())

        response = self.client.post(
            UPLOAD_URL,
            {"file": _geojson_upload(), "layer_type": "infrastructure"},
            format="multipart",
        )

        self.assertEqual(response.status_code, 200, response.data)
        infrastructure = Infrastructure.objects.get()
        self.assertEqual(infrastructure.name, "Escola Primária da Beira")
        self.assertEqual(infrastructure.type, "school")
        self.assertEqual(infrastructure.geometry.srid, 4326)

    def test_unexpected_error_does_not_leak_internal_details(self):
        self.client.force_authenticate(self._authorized_user())

        with patch(
            "maps.views._import_infrastructure",
            side_effect=RuntimeError("password=secret host=db"),
        ), self.assertLogs("maps.views", level="ERROR"):
            response = self.client.post(
                UPLOAD_URL,
                {"file": _geojson_upload(), "layer_type": "infrastructure"},
                format="multipart",
            )

        self.assertEqual(response.status_code, 500)
        self.assertNotIn("secret", response.data["error"])
        self.assertFalse(SpatialDataset.objects.exists())
