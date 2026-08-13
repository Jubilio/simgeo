import shutil
import stat
import zipfile
from pathlib import Path, PurePosixPath


MAX_ARCHIVE_MEMBERS = 1_000
MAX_ARCHIVE_UNCOMPRESSED_BYTES = 200 * 1024 * 1024
REQUIRED_SHAPEFILE_SUFFIXES = {".shp", ".shx", ".dbf"}


def _validated_member_path(member):
    normalized_name = member.filename.replace("\\", "/")
    relative_path = PurePosixPath(normalized_name)

    if (
        relative_path.is_absolute()
        or ".." in relative_path.parts
        or (relative_path.parts and ":" in relative_path.parts[0])
    ):
        raise ValueError(f"Caminho inseguro no ZIP: {member.filename}")

    mode = member.external_attr >> 16
    if stat.S_ISLNK(mode):
        raise ValueError(f"Links simbólicos não são permitidos: {member.filename}")

    return relative_path


def safely_extract_zip(archive_path, destination):
    """Extract a bounded ZIP archive without allowing path traversal."""
    destination = Path(destination).resolve()
    destination.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(archive_path, "r") as archive:
        members = archive.infolist()
        if len(members) > MAX_ARCHIVE_MEMBERS:
            raise ValueError("O ZIP contém demasiados ficheiros.")

        total_size = sum(member.file_size for member in members)
        if total_size > MAX_ARCHIVE_UNCOMPRESSED_BYTES:
            raise ValueError("O conteúdo descompactado do ZIP excede 200 MB.")

        corrupt_member = archive.testzip()
        if corrupt_member:
            raise ValueError(f"Ficheiro corrompido no ZIP: {corrupt_member}")

        extracted_paths = []
        for member in members:
            relative_path = _validated_member_path(member)
            target = destination.joinpath(*relative_path.parts).resolve()
            if target != destination and destination not in target.parents:
                raise ValueError(f"Caminho inseguro no ZIP: {member.filename}")

            if member.is_dir():
                target.mkdir(parents=True, exist_ok=True)
                continue

            target.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(member, "r") as source, target.open("wb") as output:
                shutil.copyfileobj(source, output)
            extracted_paths.append(target)

    return extracted_paths


def find_single_shapefile(directory):
    """Return one complete Shapefile, rejecting ambiguous/incomplete archives."""
    directory = Path(directory)
    shapefiles = [
        path for path in directory.rglob("*") if path.is_file() and path.suffix.lower() == ".shp"
    ]
    if not shapefiles:
        raise ValueError("Nenhum ficheiro .shp encontrado no ZIP.")
    if len(shapefiles) > 1:
        raise ValueError("O ZIP deve conter apenas um Shapefile.")

    shapefile = shapefiles[0]
    sibling_suffixes = {
        path.suffix.lower()
        for path in shapefile.parent.iterdir()
        if path.is_file() and path.stem.lower() == shapefile.stem.lower()
    }
    missing = REQUIRED_SHAPEFILE_SUFFIXES - sibling_suffixes
    if missing:
        missing_list = ", ".join(sorted(missing))
        raise ValueError(f"Shapefile incompleto. Faltam: {missing_list}.")

    return shapefile
