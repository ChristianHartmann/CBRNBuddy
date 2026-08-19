#!/usr/bin/env python3
"""
Parser for ADR Table A (the dangerous goods list) -> substances.json

Reads the CSV export of the BAM dangerous goods data service and writes the JSON file
used to seed the CBRN-Buddy database.

Source: Bundesanstalt fuer Materialforschung und -pruefung (BAM) - Datenbank GEFAHRGUT
        tes.bam.de/TES/Navigation/DE/DGG/dgg.html
        Datenlizenz Deutschland - Namensnennung - Version 2.0 (dl-de/by-2-0)

On the format: the CSV is tab separated and cp1252 encoded, not UTF-8. The package also
contains an XML variant, but that one stopped at ADR 2023 while the CSV keeps up with
the regulation.
"""

import csv
import json
import sys
from pathlib import Path

from data_version import update_data_version

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
ADR_DIR = (
    PROJECT_ROOT
    / "raw_data"
    / "gefahrgut-datenbanken"
    / "dgg-daten-adr-un"
    / "Straßenverkehr (ADR)"
)
OUTPUT_PATH = PROJECT_ROOT / "apps" / "mobile" / "assets" / "data" / "substances.json"

# The CSV from the BAM data package: cp1252 encoded and tab separated.
SOURCE_ENCODING = "cp1252"
SOURCE_DELIMITER = "\t"


def find_source(adr_dir: Path) -> Path:
    """Find the most recent ADR CSV in the data package (ADR25_csv.txt, ADR27_csv.txt, ...)."""
    candidates = sorted(adr_dir.glob("ADR*_csv.txt"))
    if not candidates:
        raise FileNotFoundError(
            f"No ADR*_csv.txt found in {adr_dir}.\n"
            "Get the data package from: https://tes.bam.de/datenbank-gefahrgut/produkte/gefahrgutdatenservice"
        )
    # The file name carries the regulation year; the highest one is the current edition.
    return candidates[-1]


def parse_adr_csv(csv_path: Path) -> list[dict]:
    """Parse ADR Table A and return a list of substance dicts."""
    with open(csv_path, encoding=SOURCE_ENCODING, newline="") as f:
        rows = list(csv.DictReader(f, delimiter=SOURCE_DELIMITER))

    substances = []

    for record in rows:
        def field(name: str) -> str:
            return (record.get(name) or "").strip()

        un_number_raw = field("S_UNNR")
        if not un_number_raw:
            continue

        # UN numbers are always four digits, zero padded
        un_number = un_number_raw.zfill(4)

        name_de = field("S_NAME")
        specification_de = field("S_SPEZIFIKATION")
        name_en = field("S_NAME_E")
        specification_en = field("S_SPEZIFIKATION_E")

        # Fallback: use the English name when there is no German one
        if not name_de and name_en:
            name_de = name_en
            specification_de = specification_en

        # Full name including the specification
        full_name_de = name_de
        if specification_de:
            full_name_de = f"{name_de}, {specification_de}"

        full_name_en = name_en
        if specification_en:
            full_name_en = f"{name_en}, {specification_en}"

        hazard_class = field("S_KLASSE")

        # Kemler number: S_GEFAHRNR wins, otherwise S_KENN1
        kemler = field("S_GEFAHRNR") or field("S_KENN1")

        packing_group = field("S_VP_GRUPPE")
        tunnel_code = field("S_TUNNEL_CODE")

        # Hazard labels from S_KENN1
        labels = field("S_KENN1")

        # Collect the special provisions
        special_provisions = [sv for i in range(1, 10) if (sv := field(f"S_SV{i}"))]

        substance = {
            "un_number": un_number,
            "name_de": full_name_de,
            "name_en": full_name_en if full_name_en else None,
            "cas_number": None,
            "hazard_class": hazard_class,
            "hazard_class_name": None,
            "kemler_number": kemler if kemler else None,
            "packing_group": packing_group if packing_group else None,
            "tunnel_code": tunnel_code if tunnel_code else None,
            "special_provisions": ",".join(special_provisions) if special_provisions else None,
            "labels": labels if labels else None,
        }

        substances.append(substance)

    return substances


def main():
    if not ADR_DIR.exists():
        print(f"ERROR: data directory not found: {ADR_DIR}")
        print("Get the data package from: https://tes.bam.de/datenbank-gefahrgut/produkte/gefahrgutdatenservice")
        sys.exit(1)

    try:
        source_path = find_source(ADR_DIR)
    except FileNotFoundError as exc:
        print(f"ERROR: {exc}")
        sys.exit(1)

    print(f"Parsing {source_path.name}...")
    substances = parse_adr_csv(source_path)

    # Statistics
    unique_un = len(set(s["un_number"] for s in substances))
    with_kemler = sum(1 for s in substances if s["kemler_number"])
    with_tunnel = sum(1 for s in substances if s["tunnel_code"])

    print(f"  Entries total:       {len(substances)}")
    print(f"  Unique UN numbers:   {unique_un}")
    print(f"  With Kemler number:  {with_kemler}")
    print(f"  With tunnel code:    {with_tunnel}")

    # Drop entries without a name; the German to English fallback already ran in the parser
    before = len(substances)
    substances = [s for s in substances if s["name_de"]]
    skipped = before - len(substances)
    if skipped:
        print(f"  Skipped (no name):   {skipped}")

    # Validation
    for s in substances:
        assert len(s["un_number"]) == 4, f"UN number is not four digits: {s['un_number']}"
        assert s["hazard_class"], f"No hazard class for UN {s['un_number']}"

    # Save
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(substances, f, ensure_ascii=False, indent=2)

    print(f"\nWritten: {OUTPUT_PATH}")
    print(f"File size: {OUTPUT_PATH.stat().st_size / 1024:.0f} KB")

    # Update the data version so the app notices the change
    update_data_version()
    print("Data version updated.")


if __name__ == "__main__":
    main()
