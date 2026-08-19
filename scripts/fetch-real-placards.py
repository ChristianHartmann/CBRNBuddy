#!/usr/bin/env python3
"""CBRN-69 - Reale Warntafel-Bilder von Roboflow Universe in den Datensatz mergen.

Lädt einen öffentlichen Roboflow-Universe-Datensatz im YOLOv8-Format, behält nur die
Warntafel-/Placard-Klassen, remappt sie auf Klasse 0 (placard_orange) und kopiert
Bilder + Labels in den bestehenden YOLO-Datensatz (images|labels / train|val|test).

Voraussetzung: kostenloser Roboflow-Account + API-Key.
    export ROBOFLOW_API_KEY=...
Einen passenden Datensatz findest du auf https://universe.roboflow.com
(Suche z. B. "hazmat placard", "ADR warntafel", "dangerous goods placard").
Workspace/Project/Version stehen in der URL bzw. im "Download Dataset"-Dialog.

Beispiel:
    ROBOFLOW_API_KEY=xxx python scripts/fetch-real-placards.py \
        --workspace some-workspace --project hazmat-placards --version 3 \
        --out scripts/datasets/warntafeln
"""
from __future__ import annotations

import argparse
import os
import re
import shutil
from pathlib import Path

import yaml

CLASS_ID = 0  # placard_orange
# Quell-Klassennamen, die als orange Warntafel zählen (case-insensitive Teilstring).
DEFAULT_KEEP = r"placard|warntafel|orange|adr|kemler|un.?number|hazmat|dangerous"
SPLIT_MAP = {"train": "train", "valid": "val", "val": "val", "test": "test"}


def remap_split(src: Path, dst_root: Path, keep_idx: set[int], prefix: str) -> int:
    """Copy images+labels from a source YOLO split, keeping only kept classes → class 0."""
    img_dir = src / "images"
    lbl_dir = src / "labels"
    if not img_dir.is_dir():
        return 0
    split = SPLIT_MAP.get(src.name, "train")
    out_img = dst_root / "images" / split
    out_lbl = dst_root / "labels" / split
    out_img.mkdir(parents=True, exist_ok=True)
    out_lbl.mkdir(parents=True, exist_ok=True)

    n = 0
    for img_path in sorted(img_dir.iterdir()):
        if img_path.suffix.lower() not in {".jpg", ".jpeg", ".png"}:
            continue
        lbl_path = lbl_dir / (img_path.stem + ".txt")
        kept_lines: list[str] = []
        if lbl_path.exists():
            for line in lbl_path.read_text().splitlines():
                parts = line.split()
                if len(parts) != 5:
                    continue
                if int(parts[0]) in keep_idx:
                    kept_lines.append(f"{CLASS_ID} {parts[1]} {parts[2]} {parts[3]} {parts[4]}")
        if not kept_lines:
            continue  # skip images without a relevant placard
        stem = f"{prefix}_{img_path.stem}"
        shutil.copy(img_path, out_img / (stem + img_path.suffix.lower()))
        (out_lbl / (stem + ".txt")).write_text("\n".join(kept_lines) + "\n")
        n += 1
    return n


def main() -> None:
    ap = argparse.ArgumentParser(description="Roboflow-Realbilder mergen (→ placard_orange).")
    ap.add_argument("--workspace", required=True)
    ap.add_argument("--project", required=True)
    ap.add_argument("--version", type=int, required=True)
    ap.add_argument("--out", type=Path, default=Path(__file__).resolve().parent / "datasets" / "warntafeln")
    ap.add_argument("--keep-classes", default=DEFAULT_KEEP,
                    help="Regex auf Quell-Klassennamen, die als Warntafel zählen")
    args = ap.parse_args()

    api_key = os.environ.get("ROBOFLOW_API_KEY")
    if not api_key:
        raise SystemExit("ROBOFLOW_API_KEY ist nicht gesetzt (export ROBOFLOW_API_KEY=...).")

    from roboflow import Roboflow

    keep_re = re.compile(args.keep_classes, re.IGNORECASE)

    # Persistent download dir (Roboflow's `location` handling is unreliable; we
    # also search cwd as a fallback and keep the data for inspection/re-use).
    dl_dir = (args.out.parent / f"_rf_{args.project}_{args.version}").resolve()
    dl_dir.mkdir(parents=True, exist_ok=True)

    rf = Roboflow(api_key=api_key)
    project = rf.workspace(args.workspace).project(args.project)
    dataset = project.version(args.version).download("yolov8", location=str(dl_dir), overwrite=True)
    print(f"Roboflow dataset.location: {getattr(dataset, 'location', '?')}")

    # Locate data.yaml robustly: declared location, our dl_dir, then cwd.
    search_roots = [Path(getattr(dataset, "location", dl_dir)), dl_dir, Path.cwd()]
    yamls: list[Path] = []
    for root in search_roots:
        if root and root.exists():
            yamls = sorted(root.rglob("data.yaml"))
            if yamls:
                break
    if not yamls:
        listing = "\n".join(f"  {p}" for p in sorted(dl_dir.iterdir())) or "  (leer)"
        raise SystemExit(
            f"Kein data.yaml gefunden. Inhalt von {dl_dir}:\n{listing}\n"
            f"(dataset.location={getattr(dataset, 'location', '?')})"
        )
    ds_yaml = yamls[0]
    ds_root = ds_yaml.parent
    print(f"data.yaml: {ds_yaml}")

    names = yaml.safe_load(ds_yaml.read_text())["names"]
    if isinstance(names, dict):
        names = [names[k] for k in sorted(names)]
    print(f"Quell-Klassen: {names}")
    keep_idx = {i for i, name in enumerate(names) if keep_re.search(str(name))}
    if not keep_idx:
        raise SystemExit(
            f"Keine passende Klasse in {names}. Passe --keep-classes an "
            f"(z. B. --keep-classes '{'|'.join(str(n) for n in names)}')."
        )
    print(f"Behalten als placard_orange: {[names[i] for i in sorted(keep_idx)]}")

    prefix = f"rf_{args.project}_{args.version}"
    total = 0
    for split_dir in ("train", "valid", "val", "test"):
        sp = ds_root / split_dir
        if sp.is_dir():
            total += remap_split(sp, args.out, keep_idx, prefix)

    print(f"Fertig: {total} reale Bilder gemerged → {args.out}")
    print("Tipp: Danach Gesamtzahl/Verhältnis prüfen (siehe README-training.md).")


if __name__ == "__main__":
    main()
