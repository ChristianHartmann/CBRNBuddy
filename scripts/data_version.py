#!/usr/bin/env python3
"""
Writes apps/mobile/assets/data/data-version.json.

On startup the app compares this file against the version stored in the device
database and reloads the reference data as soon as they differ. Without that check an
already installed app would keep serving superseded data.

Called by parse-un-numbers.py and parse-ericards.py after they write their data, and
runnable on its own:

    python3 scripts/data_version.py
"""

import hashlib
import json
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
DATA_DIR = PROJECT_ROOT / "apps" / "mobile" / "assets" / "data"
VERSION_PATH = DATA_DIR / "data-version.json"

# Key in data-version.json -> file in the asset directory
DATASETS = {
    "substances": "substances.json",
    "ericards": "ericards.json",
}


def file_digest(path: Path) -> str:
    """Short content hash. A missing file is itself a stable state."""
    if not path.exists():
        return "missing"
    return hashlib.sha256(path.read_bytes()).hexdigest()[:16]


def update_data_version() -> dict[str, str]:
    version = {key: file_digest(DATA_DIR / name) for key, name in DATASETS.items()}

    VERSION_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(VERSION_PATH, "w", encoding="utf-8") as f:
        json.dump(version, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\n")

    return version


def main():
    version = update_data_version()
    print(f"Data version written: {VERSION_PATH}")
    for key, digest in sorted(version.items()):
        print(f"  {key:<16} {digest}")


if __name__ == "__main__":
    main()
