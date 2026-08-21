#!/usr/bin/env python3
"""Validate the versioned registry of SimGeo scientific modules."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


DEFAULT_REGISTRY = Path("docs/scientific-modules/registry.json")
MODULE_ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
VALID_STATUSES = {"screening", "external-operational-feed", "operational"}
VALID_LEVELS = {"V0", "V1", "V2", "V3", "V4"}
REQUIRED_MODULE_FIELDS = {
    "id",
    "title",
    "status",
    "scientific_question",
    "decision_use",
    "not_for",
    "service",
    "methodology",
    "endpoints",
    "spatial_unit",
    "temporal_unit",
    "data_sources",
    "validation",
}
REQUIRED_VALIDATION_FIELDS = {
    "level",
    "field_validated",
    "reference_case",
    "tests",
}


def _non_empty_text(value: object) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _string_list(value: object) -> bool:
    return (
        isinstance(value, list)
        and bool(value)
        and all(_non_empty_text(item) for item in value)
    )


def _validate_repo_file(
    repo_root: Path, value: object, label: str, errors: list[str]
) -> None:
    if not _non_empty_text(value):
        errors.append(f"{label} deve ser um caminho não vazio.")
        return

    candidate = (repo_root / str(value)).resolve()
    try:
        candidate.relative_to(repo_root.resolve())
    except ValueError:
        errors.append(f"{label} aponta para fora do repositório: {value}")
        return

    if not candidate.is_file():
        errors.append(f"{label} não existe: {value}")


def validate_registry(registry_path: Path, repo_root: Path | None = None) -> list[str]:
    """Return all registry errors instead of failing on the first problem."""
    registry_path = registry_path.resolve()
    repo_root = (repo_root or registry_path.parents[2]).resolve()
    errors: list[str] = []

    try:
        registry = json.loads(registry_path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return [f"Registo não encontrado: {registry_path}"]
    except json.JSONDecodeError as exc:
        return [f"JSON inválido em {registry_path}: {exc}"]

    if registry.get("schema_version") != "1.0":
        errors.append("schema_version deve ser '1.0'.")
    if not _non_empty_text(registry.get("updated")):
        errors.append("updated deve indicar a data da última revisão.")

    modules = registry.get("modules")
    if not isinstance(modules, list) or not modules:
        errors.append("modules deve ser uma lista não vazia.")
        return errors

    seen_ids: set[str] = set()
    for index, module in enumerate(modules):
        prefix = f"modules[{index}]"
        if not isinstance(module, dict):
            errors.append(f"{prefix} deve ser um objeto.")
            continue

        missing = sorted(REQUIRED_MODULE_FIELDS - set(module))
        if missing:
            errors.append(f"{prefix} não contém: {', '.join(missing)}")

        module_id = module.get("id")
        if not _non_empty_text(module_id) or not MODULE_ID_PATTERN.fullmatch(module_id):
            errors.append(f"{prefix}.id deve usar kebab-case: {module_id!r}")
        elif module_id in seen_ids:
            errors.append(f"id duplicado: {module_id}")
        else:
            seen_ids.add(module_id)

        for field in (
            "title",
            "scientific_question",
            "decision_use",
            "not_for",
            "spatial_unit",
            "temporal_unit",
        ):
            if not _non_empty_text(module.get(field)):
                errors.append(f"{prefix}.{field} deve ser texto não vazio.")

        if module.get("status") not in VALID_STATUSES:
            errors.append(
                f"{prefix}.status deve ser um de: {', '.join(sorted(VALID_STATUSES))}."
            )

        for field in ("endpoints", "data_sources"):
            if not _string_list(module.get(field)):
                errors.append(f"{prefix}.{field} deve ser uma lista de textos.")

        _validate_repo_file(repo_root, module.get("service"), f"{prefix}.service", errors)
        _validate_repo_file(
            repo_root, module.get("methodology"), f"{prefix}.methodology", errors
        )

        validation = module.get("validation")
        if not isinstance(validation, dict):
            errors.append(f"{prefix}.validation deve ser um objeto.")
            continue

        validation_missing = sorted(REQUIRED_VALIDATION_FIELDS - set(validation))
        if validation_missing:
            errors.append(
                f"{prefix}.validation não contém: {', '.join(validation_missing)}"
            )
        if validation.get("level") not in VALID_LEVELS:
            errors.append(f"{prefix}.validation.level deve estar entre V0 e V4.")
        if not isinstance(validation.get("field_validated"), bool):
            errors.append(f"{prefix}.validation.field_validated deve ser booleano.")
        if not _non_empty_text(validation.get("reference_case")):
            errors.append(f"{prefix}.validation.reference_case deve ser declarado.")
        if not _string_list(validation.get("tests")):
            errors.append(f"{prefix}.validation.tests deve listar testes reais.")

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("registry", nargs="?", type=Path, default=DEFAULT_REGISTRY)
    parser.add_argument("--repo-root", type=Path, default=Path.cwd())
    args = parser.parse_args()

    errors = validate_registry(args.registry, args.repo_root)
    if errors:
        print("Scientific registry validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    data = json.loads(args.registry.read_text(encoding="utf-8"))
    print(f"Scientific registry valid: {len(data['modules'])} modules.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
