#!/usr/bin/env python3
"""Build the versioned Mozambique Admin2 baseline fixture from the OCHA workbook."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import pandas as pd


AGE_BANDS = (
    "00_04",
    "05_09",
    "10_14",
    "15_19",
    "20_24",
    "25_29",
    "30_34",
    "35_39",
    "40_44",
    "45_49",
    "50_54",
    "55_59",
    "60_64",
    "65_69",
    "70_74",
    "75_79",
    "80Plus",
)


def _number(value, *, integer=True):
    if pd.isna(value):
        return None
    number = float(value)
    return int(round(number)) if integer else round(number, 1)


def _clean_text(value):
    """Repair the UTF-8-as-Latin-1 mojibake present in a few workbook names."""
    text = str(value).strip()
    if "Ã" not in text and "Â" not in text:
        return text
    try:
        return text.encode("latin-1").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return text


def _validate_join(left, right, sheet_name):
    left_codes = set(left["ADM2_PCODE"])
    right_codes = set(right["ADM2_PCODE"])
    if left_codes != right_codes:
        missing = sorted(left_codes - right_codes)
        extra = sorted(right_codes - left_codes)
        raise ValueError(
            f"P-codes incompatíveis em {sheet_name}: missing={missing}, extra={extra}"
        )
    if right["ADM2_PCODE"].duplicated().any():
        raise ValueError(f"P-codes duplicados em {sheet_name}")


def build_fixture(workbook_path: Path):
    population = pd.read_excel(workbook_path, sheet_name="Moz admin2")
    children = pd.read_excel(workbook_path, sheet_name="Additional POP SADD")
    baseline = pd.read_excel(workbook_path, sheet_name="Baseline data", header=2).rename(
        columns={
            "ADM1 PT": "ADM1_PT",
            "ADM1 PCODE": "ADM1_PCODE",
            "ADM2 PT": "ADM2_PT",
            "ADM2 Pcode": "ADM2_PCODE",
        }
    )

    for frame, name in ((population, "Moz admin2"), (children, "Additional POP SADD")):
        if frame["ADM2_PCODE"].duplicated().any():
            raise ValueError(f"P-codes duplicados em {name}")
    _validate_join(population, children, "Additional POP SADD")
    _validate_join(population, baseline, "Baseline data")

    child_index = children.set_index("ADM2_PCODE")
    baseline_index = baseline.set_index("ADM2_PCODE")
    records = []

    for row in population.to_dict("records"):
        pcode = row["ADM2_PCODE"]
        child = child_index.loc[pcode]
        displacement = baseline_index.loc[pcode]
        total = _number(row["T_TL"])
        under_18 = _number(child["T_00_17"])
        older_60 = sum(
            value
            for value in (_number(row[f"T_{band}"]) for band in AGE_BANDS[12:])
            if value is not None
        ) if total is not None else None

        record = {
            "adm1_name": _clean_text(row["ADM1_PT"]),
            "adm1_pcode": row["ADM1_PCODE"],
            "adm2_name": _clean_text(row["ADM2_PT"]),
            "adm2_pcode": pcode,
            "population": {
                "total": total,
                "female": _number(row["F_TL"]),
                "male": _number(row["M_TL"]),
                "under_5": _number(row["T_00_04"]),
                "under_18": under_18,
                "age_60_plus": older_60,
                "pwd_planning_estimate": round(total * 0.15, 1) if total is not None else None,
                "age_bands_total": {
                    band: _number(row[f"T_{band}"]) for band in AGE_BANDS
                },
            },
            "displacement": {
                "idps_dtm_r22": _number(displacement[" IDPs (DTM R22)"]),
                "idps_female": _number(displacement["Total number of women IDPs"]),
                "idps_male": _number(displacement["Total number of men IDPs"]),
                "idps_children": _number(displacement["Total number of children IDPs"]),
                "returnees_dtm_r22": _number(displacement["Returness DTM R22"]),
                "returnees_female": _number(displacement["Total number of women (Returness)"]),
                "returnees_male": _number(displacement["Total number of men (Returness)"]),
                "returnees_children": _number(displacement["Total number of children (Returness)"]),
            },
        }
        if total is not None:
            if record["population"]["female"] + record["population"]["male"] != total:
                raise ValueError(f"Total por sexo inconsistente em {pcode}")
            if sum(record["population"]["age_bands_total"].values()) != total:
                raise ValueError(f"Total por faixa etária inconsistente em {pcode}")
            if under_18 is not None and under_18 > total:
                raise ValueError(f"População 0–17 superior ao total em {pcode}")
        records.append(record)

    records.sort(key=lambda item: (item["adm1_pcode"], item["adm2_pcode"]))
    null_population = [item["adm2_pcode"] for item in records if item["population"]["total"] is None]
    null_idps = [item["adm2_pcode"] for item in records if item["displacement"]["idps_dtm_r22"] is None]
    null_returnees = [item["adm2_pcode"] for item in records if item["displacement"]["returnees_dtm_r22"] is None]

    return {
        "schema_version": 1,
        "country": {"name_pt": "Moçambique", "name_en": "Mozambique", "iso3": "MOZ", "pcode": "MZ"},
        "source": {
            "publisher": "OCHA Mozambique",
            "workbook": workbook_path.name,
            "workbook_sha256": hashlib.sha256(workbook_path.read_bytes()).hexdigest(),
            "population_year": 2025,
            "displacement_round": "DTM R22",
            "workbook_date": "2024-08-15",
            "sheets": ["Moz admin2", "Additional POP SADD", "Baseline data"],
        },
        "methodology": {
            "join_key": "ADM2_PCODE",
            "geometry_join": "As tabelas usam P-code; a visualização GAUL 2015 usa correspondência de nome normalizado e reporta áreas sem correspondência.",
            "pwd_planning_estimate": "15% da população total; estimativa de planeamento, não observação.",
            "dtm_caseload": "Soma dos valores disponíveis de IDPs e retornados da DTM R22; campos ausentes permanecem nulos.",
            "null_policy": "Ausente não é convertido em zero.",
        },
        "quality": {
            "admin1_count": len({item["adm1_pcode"] for item in records}),
            "admin2_count": len(records),
            "null_population_pcodes": null_population,
            "null_idp_pcodes": null_idps,
            "null_returnee_pcodes": null_returnees,
        },
        "admin2": records,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("workbook", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    fixture = build_fixture(args.workbook)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(fixture, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        f"Gerados {fixture['quality']['admin2_count']} Admin2 e "
        f"{fixture['quality']['admin1_count']} Admin1 em {args.output}"
    )


if __name__ == "__main__":
    main()
