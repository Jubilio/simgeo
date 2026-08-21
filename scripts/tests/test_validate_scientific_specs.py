import json
import tempfile
import unittest
from copy import deepcopy
from pathlib import Path

from scripts.validate_scientific_specs import validate_registry


REPO_ROOT = Path(__file__).resolve().parents[2]
REGISTRY_PATH = REPO_ROOT / "docs/scientific-modules/registry.json"


class ScientificRegistryTests(unittest.TestCase):
    def test_repository_registry_is_valid(self):
        self.assertEqual(validate_registry(REGISTRY_PATH, REPO_ROOT), [])

    def _temporary_registry(self, mutate):
        registry = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
        mutate(registry)
        temporary_directory = tempfile.TemporaryDirectory()
        path = Path(temporary_directory.name) / "registry.json"
        path.write_text(json.dumps(registry), encoding="utf-8")
        return temporary_directory, path

    def test_rejects_duplicate_module_ids(self):
        def mutate(registry):
            duplicate = deepcopy(registry["modules"][0])
            registry["modules"].append(duplicate)

        temporary_directory, path = self._temporary_registry(mutate)
        self.addCleanup(temporary_directory.cleanup)

        errors = validate_registry(path, REPO_ROOT)

        self.assertIn("id duplicado: flood-impact", errors)

    def test_rejects_missing_or_external_methodology(self):
        def mutate(registry):
            registry["modules"][0]["methodology"] = "../outside.md"

        temporary_directory, path = self._temporary_registry(mutate)
        self.addCleanup(temporary_directory.cleanup)

        errors = validate_registry(path, REPO_ROOT)

        self.assertTrue(any("fora do repositório" in error for error in errors))

    def test_requires_declared_validation_evidence(self):
        def mutate(registry):
            registry["modules"][0]["validation"]["tests"] = []
            registry["modules"][0]["validation"]["level"] = "validated"

        temporary_directory, path = self._temporary_registry(mutate)
        self.addCleanup(temporary_directory.cleanup)

        errors = validate_registry(path, REPO_ROOT)

        self.assertTrue(any("entre V0 e V4" in error for error in errors))
        self.assertTrue(any("listar testes reais" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
