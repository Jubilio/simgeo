from unittest.mock import patch

from django.test import SimpleTestCase
from rest_framework.test import APIRequestFactory

from simulation.services.cyclone_service import validate_cyclone_parameters
from simulation.services.flood_impact_service import (
    validate_flood_impact_parameters,
)
from simulation.services.forest_dynamics_service import (
    _normalize_custom_geometries,
    validate_forest_dynamics_parameters,
)
from simulation.services.malaria_service import validate_malaria_parameters
from simulation.views import (
    GEECycloneView,
    GEEFloodImpactView,
    GEEForestDynamicsView,
    GEEMalariaSuitabilityView,
)


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


class CycloneParameterValidationTests(SimpleTestCase):
    def test_accepts_historical_event(self):
        self.assertEqual(
            validate_cyclone_parameters("2023-03-11", "2023-03-13", "wind"),
            ("2023-03-11", "2023-03-13", "wind"),
        )

    def test_rejects_invalid_layer_and_reversed_dates(self):
        with self.assertRaisesMessage(ValueError, "type"):
            validate_cyclone_parameters("2023-03-11", "2023-03-13", "gust")
        with self.assertRaisesMessage(ValueError, "anterior"):
            validate_cyclone_parameters("2023-03-13", "2023-03-11", "rain")

    def test_rejects_intervals_longer_than_30_days(self):
        with self.assertRaisesMessage(ValueError, "30 dias"):
            validate_cyclone_parameters("2023-03-01", "2023-03-31", "rain")


class FloodImpactParameterValidationTests(SimpleTestCase):
    def test_accepts_supported_glofas_return_period(self):
        self.assertEqual(
            validate_flood_impact_parameters("glofas", "75"),
            ("glofas", 75, None, None),
        )

    def test_rejects_unsupported_glofas_return_period(self):
        with self.assertRaisesMessage(ValueError, "Valores suportados"):
            validate_flood_impact_parameters("glofas", 5)

    def test_validates_sentinel1_dates(self):
        self.assertEqual(
            validate_flood_impact_parameters(
                "sentinel1", 100, "2019-03-14", "2019-03-16"
            ),
            ("sentinel1", None, "2019-03-14", "2019-03-16"),
        )
        with self.assertRaisesMessage(ValueError, "obrigatórios"):
            validate_flood_impact_parameters("sentinel1", 100)


class ForestDynamicsParameterValidationTests(SimpleTestCase):
    def test_accepts_country_and_province_analysis(self):
        self.assertEqual(
            validate_forest_dynamics_parameters(2016, 2025),
            (2016, 2025, "country", None),
        )
        self.assertEqual(
            validate_forest_dynamics_parameters(
                "2018", "2024", "province", "Cabo Delgado"
            ),
            (2018, 2024, "province", "Cabo Delgado"),
        )
        self.assertEqual(
            validate_forest_dynamics_parameters(
                2020,
                2024,
                "custom",
                "Área piloto",
                {"type": "Polygon", "coordinates": []},
            ),
            (2020, 2024, "custom", "Área piloto"),
        )

    def test_rejects_invalid_period_and_missing_province(self):
        with self.assertRaisesMessage(ValueError, "anterior"):
            validate_forest_dynamics_parameters(2024, 2024)
        with self.assertRaisesMessage(ValueError, "2016"):
            validate_forest_dynamics_parameters(2015, 2024)
        with self.assertRaisesMessage(ValueError, "area_name"):
            validate_forest_dynamics_parameters(2020, 2024, "province")
        with self.assertRaisesMessage(ValueError, "geometry"):
            validate_forest_dynamics_parameters(2020, 2024, "custom")

    def test_normalizes_custom_feature_collection(self):
        polygon = {
            "type": "Polygon",
            "coordinates": [[[32, -20], [33, -20], [33, -19], [32, -20]]],
        }
        self.assertEqual(
            _normalize_custom_geometries(
                {
                    "type": "FeatureCollection",
                    "features": [{"type": "Feature", "geometry": polygon}],
                }
            ),
            [polygon],
        )

    def test_rejects_non_polygon_custom_geometry(self):
        with self.assertRaisesMessage(ValueError, "Polygon"):
            _normalize_custom_geometries(
                {"type": "Point", "coordinates": [32, -20]}
            )


class ForestDynamicsViewTests(SimpleTestCase):
    def setUp(self):
        self.factory = APIRequestFactory()

    @patch("simulation.views.get_forest_area_options")
    def test_returns_province_options(self, options_mock):
        options_mock.return_value = ["Cabo Delgado", "Nampula"]
        request = self.factory.get(
            "/api/simulation/gee/forest-dynamics/", {"scope": "province"}
        )

        response = GEEForestDynamicsView.as_view()(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["areas"], ["Cabo Delgado", "Nampula"])
        options_mock.assert_called_once_with("province")

    @patch("simulation.views.get_forest_dynamics")
    def test_returns_forest_analysis(self, service_mock):
        service_mock.return_value = {
            "gee_layer": {"tile_url": "https://earthengine.example/{z}/{x}/{y}"},
            "stats": {"net_change_ha": 98},
            "timeseries": [],
            "transitions": {},
        }
        request = self.factory.post(
            "/api/simulation/gee/forest-dynamics/",
            {
                "start_year": 2016,
                "end_year": 2025,
                "scope": "province",
                "area_name": "Cabo Delgado",
            },
            format="json",
        )

        response = GEEForestDynamicsView.as_view()(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["stats"]["net_change_ha"], 98)
        service_mock.assert_called_once_with(
            start_year=2016,
            end_year=2025,
            scope="province",
            area_name="Cabo Delgado",
            geometry=None,
        )

    @patch("simulation.views.get_forest_dynamics")
    def test_returns_400_for_invalid_parameters(self, service_mock):
        service_mock.side_effect = ValueError("start_year deve ser anterior")
        request = self.factory.post(
            "/api/simulation/gee/forest-dynamics/",
            {"start_year": 2025, "end_year": 2025},
            format="json",
        )

        response = GEEForestDynamicsView.as_view()(request)

        self.assertEqual(response.status_code, 400)
        self.assertIn("anterior", response.data["error"])


class NewSimulationViewValidationTests(SimpleTestCase):
    def setUp(self):
        self.factory = APIRequestFactory()

    def test_cyclone_view_returns_400_for_invalid_date_range(self):
        request = self.factory.get(
            "/api/simulation/gee/cyclone/",
            {
                "start_date": "2023-03-13",
                "end_date": "2023-03-11",
                "type": "rain",
            },
        )

        response = GEECycloneView.as_view()(request)

        self.assertEqual(response.status_code, 400)
        self.assertIn("anterior", response.data["error"])

    def test_flood_impact_view_returns_400_for_invalid_return_period(self):
        request = self.factory.post(
            "/api/simulation/gee/flood-impact/",
            {"engine": "glofas", "return_period": 5},
            format="json",
        )

        response = GEEFloodImpactView.as_view()(request)

        self.assertEqual(response.status_code, 400)
        self.assertIn("Valores suportados", response.data["error"])

    @patch("simulation.views.get_flood_impact")
    def test_flood_impact_view_preserves_timeout_message(self, service_mock):
        service_mock.side_effect = RuntimeError(
            "O Earth Engine excedeu o tempo de cálculo da exposição."
        )
        request = self.factory.post(
            "/api/simulation/gee/flood-impact/",
            {"engine": "glofas", "return_period": 100},
            format="json",
        )

        response = GEEFloodImpactView.as_view()(request)

        self.assertEqual(response.status_code, 503)
        self.assertIn("excedeu o tempo", response.data["error"])
