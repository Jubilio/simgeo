from unittest.mock import patch

from django.test import SimpleTestCase
from rest_framework.test import APIRequestFactory

from simulation.services.malaria_service import validate_malaria_parameters
from simulation.views import GEEMalariaSuitabilityView


class MalariaParameterValidationTests(SimpleTestCase):
    def test_accepts_annual_and_monthly_periods(self):
        self.assertEqual(validate_malaria_parameters(2020, 2025, 0), (2020, 2025, 0))
        self.assertEqual(validate_malaria_parameters("2020", "2025", "2"), (2020, 2025, 2))

    def test_rejects_reversed_year_range(self):
        with self.assertRaisesMessage(ValueError, "start_year"):
            validate_malaria_parameters(2025, 2020, 0)

    def test_rejects_invalid_month(self):
        with self.assertRaisesMessage(ValueError, "month"):
            validate_malaria_parameters(2020, 2025, 13)


class MalariaSuitabilityViewTests(SimpleTestCase):
    def setUp(self):
        self.factory = APIRequestFactory()

    @patch("simulation.views.get_malaria_suitability_tiles")
    def test_returns_gee_layer(self, service_mock):
        service_mock.return_value = {
            "tile_url": "https://earthengine.example/{z}/{x}/{y}",
            "metadata": {"country": "Mozambique"},
        }
        request = self.factory.get(
            "/api/simulation/gee/malaria-suitability/",
            {"start_year": 2020, "end_year": 2025, "month": 1},
        )

        response = GEEMalariaSuitabilityView.as_view()(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "success")
        self.assertEqual(response.data["gee_layer"]["metadata"]["country"], "Mozambique")
        service_mock.assert_called_once_with(
            start_year="2020", end_year="2025", month="1"
        )

    @patch("simulation.views.get_malaria_suitability_tiles")
    def test_returns_400_for_invalid_parameters(self, service_mock):
        service_mock.side_effect = ValueError("month deve estar entre 0 e 12.")
        request = self.factory.get(
            "/api/simulation/gee/malaria-suitability/", {"month": 13}
        )

        response = GEEMalariaSuitabilityView.as_view()(request)

        self.assertEqual(response.status_code, 400)
        self.assertIn("month", response.data["error"])
