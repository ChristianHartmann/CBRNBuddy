#!/usr/bin/env python3
"""CBRN-70 - YOLO26-nano training for placard detection (class: placard_orange).

Trainiert per Transfer Learning ein custom YOLO26-nano Modell auf dem von CBRN-69
erzeugten Datensatz (synthetische + reale ADR-Warntafeln) und prüft anschließend das
Akzeptanzkriterium mAP > 0.8 auf dem Validierungs-Split.

Läuft lokal (CPU/GPU) und auf Colab/RunPod. Das Export-/TFLite-Thema gehört nicht hierher,
sondern in CBRN-71.

Setup (eigenes venv, getrennt von der CBRN-69-Toolchain - torch ist groß):
    python3 -m venv scripts/.venv-train
    scripts/.venv-train/bin/pip install -r scripts/requirements-train.txt

Beispiel:
    scripts/.venv-train/bin/python scripts/train-yolo.py \
        --data scripts/datasets/warntafeln/warntafeln.yaml \
        --epochs 100 --imgsz 640

Äquivalent zur Ultralytics-CLI, nur mit Pre-Flight-Checks und mAP-Gate:
    yolo detect train data=scripts/datasets/warntafeln/warntafeln.yaml model=yolo26n.pt epochs=100 imgsz=640
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DATA = REPO_ROOT / "scripts" / "datasets" / "warntafeln" / "warntafeln.yaml"
DEFAULT_MODEL = "yolo26n.pt"  # vortrainiertes YOLO26-nano (wird bei Bedarf auto-geladen)
DEFAULT_PROJECT = REPO_ROOT / "scripts" / "runs" / "warntafeln"

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def resolve_dataset_root(data_yaml: Path) -> Path:
    """Resolve `path:` from data.yaml relative to the YAML file, or keep it if absolute."""
    cfg = yaml.safe_load(data_yaml.read_text())
    raw = Path(cfg.get("path", "."))
    return raw if raw.is_absolute() else (data_yaml.parent / raw).resolve()


def count_images(split_dir: Path) -> int:
    if not split_dir.is_dir():
        return 0
    return sum(1 for p in split_dir.iterdir() if p.suffix.lower() in IMAGE_SUFFIXES)


def preflight(data_yaml: Path) -> None:
    """Check the dataset before burning GPU time."""
    if not data_yaml.is_file():
        sys.exit(
            f"ERROR: data.yaml not found: {data_yaml}\n"
            "  → Erst den Datensatz mit scripts/generate-synth-data.py erzeugen "
            "(siehe scripts/README-training.md)."
        )

    root = resolve_dataset_root(data_yaml)
    counts = {s: count_images(root / "images" / s) for s in ("train", "val", "test")}
    print(f"Datensatz: {root}")
    for split, n in counts.items():
        print(f"  {split:<5} {n:>5} Bilder")

    if counts["train"] == 0:
        sys.exit("FEHLER: Kein einziges Trainingsbild gefunden (images/train ist leer).")
    if counts["val"] == 0:
        sys.exit(
            "FEHLER: Kein Validierungsbild (images/val leer) - ohne val-Split lässt sich "
            "kein mAP berechnen und das Akzeptanzkriterium nicht prüfen."
        )


def pick_device(requested: str) -> str:
    """'auto' picks the GPU when available, otherwise CPU. Any other value is passed through."""
    if requested != "auto":
        return requested
    try:
        import torch

        if torch.cuda.is_available():
            return "0"
        if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
            return "mps"
    except ImportError:
        pass
    return "cpu"


def main() -> None:
    parser = argparse.ArgumentParser(
        description="CBRN-70: YOLO26-nano auf Warntafel-Datensatz trainieren + mAP prüfen.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA, help="YOLO data.yaml")
    parser.add_argument("--model", default=DEFAULT_MODEL, help="Basismodell für Transfer Learning")
    parser.add_argument("--epochs", type=int, default=100)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--batch", type=int, default=-1, help="-1 = automatische Batch-Größe (GPU)")
    parser.add_argument("--device", default="auto", help="auto | cpu | 0 | 0,1 | mps")
    parser.add_argument("--patience", type=int, default=20, help="Early-Stopping-Geduld (Epochen)")
    parser.add_argument("--seed", type=int, default=0, help="Reproduzierbarkeit")
    parser.add_argument("--project", type=Path, default=DEFAULT_PROJECT, help="Ausgabe-Wurzel der Runs")
    parser.add_argument("--name", default="yolo26n", help="Run-Name (Unterordner in --project)")
    parser.add_argument("--resume", action="store_true", help="Letzten Run unter --project/--name fortsetzen")
    parser.add_argument(
        "--min-map", type=float, default=0.8,
        help="Akzeptanzschwelle für mAP@0.5 (CBRN-70: > 0.8)",
    )
    args = parser.parse_args()

    preflight(args.data)

    try:
        from ultralytics import YOLO
    except ImportError:
        sys.exit(
            "FEHLER: ultralytics nicht installiert.\n"
            "  → scripts/.venv-train/bin/pip install -r scripts/requirements-train.txt"
        )

    device = pick_device(args.device)
    print(f"\nTraining: model={args.model} device={device} epochs={args.epochs} imgsz={args.imgsz}\n")

    model = YOLO(args.model)
    model.train(
        data=str(args.data),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        device=device,
        patience=args.patience,
        seed=args.seed,
        project=str(args.project),
        name=args.name,
        resume=args.resume,
        plots=True,
    )

    # Evaluate the best checkpoint on the val split, which is the number that counts.
    metrics = model.val(data=str(args.data), imgsz=args.imgsz, device=device)
    box = metrics.box
    summary = {
        "map50_95": round(float(box.map), 4),
        "map50": round(float(box.map50), 4),
        "precision": round(float(box.mp), 4),
        "recall": round(float(box.mr), 4),
    }

    print("\n=== Validierungs-Metriken (best.pt) ===")
    print(f"  mAP@0.5      : {summary['map50']:.4f}")
    print(f"  mAP@0.5:0.95 : {summary['map50_95']:.4f}")
    print(f"  Precision    : {summary['precision']:.4f}")
    print(f"  Recall       : {summary['recall']:.4f}")

    run_dir = args.project / args.name
    weights = run_dir / "weights" / "best.pt"
    (run_dir / "metrics.json").write_text(json.dumps(summary, indent=2))
    print(f"\nBestes Modell : {weights}")
    print(f"Metriken      : {run_dir / 'metrics.json'}")

    # Akzeptanzkriterium CBRN-70: mAP@0.5 > 0.8
    passed = summary["map50"] > args.min_map
    print(
        f"\nAkzeptanzkriterium mAP@0.5 > {args.min_map:.2f}: "
        f"{'BESTANDEN ✓' if passed else 'NICHT erreicht ✗'} ({summary['map50']:.4f})"
    )
    if not passed:
        print(
            "  → Mehr/realere Daten (Roboflow-Anteil erhöhen), längeres Training oder "
            "größeres imgsz versuchen, bevor an CBRN-71 (Export) übergeben wird."
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
