import tempfile
import unittest
import zipfile
from pathlib import Path

from maps.upload_utils import find_single_shapefile, safely_extract_zip


class SafeZipExtractionTests(unittest.TestCase):
    def test_rejects_path_traversal(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            archive_path = root / "unsafe.zip"
            with zipfile.ZipFile(archive_path, "w") as archive:
                archive.writestr("../outside.txt", "unsafe")

            with self.assertRaisesRegex(ValueError, "inseguro"):
                safely_extract_zip(archive_path, root / "output")

    def test_extracts_complete_nested_shapefile(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            archive_path = root / "data.zip"
            with zipfile.ZipFile(archive_path, "w") as archive:
                for suffix in (".shp", ".shx", ".dbf", ".prj"):
                    archive.writestr(f"nested/places{suffix}", "data")

            output = root / "output"
            safely_extract_zip(archive_path, output)

            self.assertEqual(
                find_single_shapefile(output),
                output / "nested" / "places.shp",
            )

    def test_rejects_incomplete_shapefile(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            (root / "places.shp").write_text("data", encoding="utf-8")

            with self.assertRaisesRegex(ValueError, "Faltam"):
                find_single_shapefile(root)


if __name__ == "__main__":
    unittest.main()
