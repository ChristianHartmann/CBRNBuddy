#!/usr/bin/env python3
"""CBRN-71 - Trainiertes YOLO26-nano nach TFLite (INT8) exportieren (Warntafel-Erkennung).

Nimmt das beste Checkpoint aus CBRN-70 (best.pt), exportiert es per Ultralytics-built-in
nach TFLite mit INT8-Quantisierung (Kalibrierung über den Trainings-Datensatz), prüft die
Modellgröße (< 10 MB) und verifiziert die Inferenz auf den Testbildern. Das fertige Modell
landet als App-Asset in apps/mobile/assets/models/ und wird in CBRN-72 in der App geladen.

Hinweis: Der TFLite-INT8-Export läuft über die Kette pt → ONNX → TF SavedModel → TFLite.
Ultralytics installiert die nötigen Zusatzpakete (tensorflow, onnx, onnx2tf, …) beim ersten
Lauf automatisch nach - der erste Export dauert daher länger.

Beispiel:
    scripts/.venv-train/bin/python scripts/export-tflite.py \
        --weights scripts/runs/warntafeln/yolo26n/weights/best.pt
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_WEIGHTS = REPO_ROOT / "scripts" / "runs" / "warntafeln" / "yolo26n" / "weights" / "best.pt"
DEFAULT_DATA = REPO_ROOT / "scripts" / "datasets" / "warntafeln" / "warntafeln.yaml"
DEFAULT_TEST = REPO_ROOT / "scripts" / "datasets" / "warntafeln" / "images" / "test"
DEFAULT_OUT = REPO_ROOT / "apps" / "mobile" / "assets" / "models"

MODEL_BASENAME = "placard_detector"  # → placard_detector.tflite + placard_detector.json
CLASS_NAMES = ["placard_orange"]
RECOMMENDED_CONF = 0.25  # aus CBRN-70 Real-Check: entfernte/verschattete Tafeln → niedrige conf


def main() -> None:
    parser = argparse.ArgumentParser(
        description="CBRN-71: YOLO26-nano → TFLite (INT8) exportieren + verifizieren.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("--weights", type=Path, default=DEFAULT_WEIGHTS, help="best.pt aus CBRN-70")
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA, help="data.yaml (INT8-Kalibrierung)")
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--test-source", type=Path, default=DEFAULT_TEST, help="Bilder für Inferenz-Test")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help="Ziel-Ordner (App-Asset)")
    parser.add_argument("--max-size-mb", type=float, default=10.0, help="Größen-Gate (CBRN-71: < 10 MB)")
    parser.add_argument("--no-int8", action="store_true", help="FP32-Export (Debug; kein Größen-Gate-Ziel)")
    args = parser.parse_args()

    if not args.weights.is_file():
        sys.exit(
            f"FEHLER: Gewichte nicht gefunden: {args.weights}\n"
            "  → Erst CBRN-70 trainieren (scripts/train-yolo.py)."
        )
    if not args.no_int8 and not args.data.is_file():
        sys.exit(
            f"FEHLER: data.yaml für INT8-Kalibrierung nicht gefunden: {args.data}\n"
            "  → Datensatz aus CBRN-69 wird zur Kalibrierung gebraucht (oder --no-int8)."
        )

    try:
        from ultralytics import YOLO
    except ImportError:
        sys.exit(
            "FEHLER: ultralytics nicht installiert.\n"
            "  → scripts/.venv-train/bin/pip install -r scripts/requirements-train.txt"
        )

    int8 = not args.no_int8
    print(f"Export: {args.weights.name} → TFLite (int8={int8}, imgsz={args.imgsz})")
    print("Erster Lauf installiert ggf. tensorflow/onnx/onnx2tf nach - das dauert.\n")

    model = YOLO(str(args.weights))
    exported = model.export(
        format="tflite",
        int8=int8,
        data=str(args.data) if int8 else None,
        imgsz=args.imgsz,
    )

    # export() returns the path to the .tflite; also look inside a SavedModel folder defensively.
    tflite_path = Path(exported)
    if tflite_path.is_dir():
        candidates = sorted(tflite_path.glob("*.tflite"))
        if not candidates:
            sys.exit(f"FEHLER: keine .tflite in {tflite_path} gefunden.")
        # bevorzugt die quantisierte Variante
        tflite_path = next((c for c in candidates if "int8" in c.name or "integer" in c.name), candidates[0])

    size_mb = tflite_path.stat().st_size / (1024 * 1024)
    print(f"\nExportiert: {tflite_path}  ({size_mb:.2f} MB)")

    # Größen-Gate
    if size_mb >= args.max_size_mb:
        print(f"WARNUNG: Modell ≥ {args.max_size_mb} MB - Akzeptanzkriterium verfehlt.")
    else:
        print(f"Größen-Gate < {args.max_size_mb} MB: BESTANDEN ✓")

    # Als App-Asset ablegen (stabiler Name) + Sidecar-Metadaten für CBRN-72
    args.out.mkdir(parents=True, exist_ok=True)
    dst = args.out / f"{MODEL_BASENAME}.tflite"
    shutil.copy2(tflite_path, dst)
    meta = {
        "model": dst.name,
        "task": "detect",
        "imgsz": args.imgsz,
        "int8": int8,
        "names": CLASS_NAMES,
        "recommended_conf": RECOMMENDED_CONF,
        "source_weights": str(args.weights.relative_to(REPO_ROOT)),
    }
    (args.out / f"{MODEL_BASENAME}.json").write_text(json.dumps(meta, indent=2))
    print(f"App-Asset : {dst}")
    print(f"Metadaten : {args.out / (MODEL_BASENAME + '.json')}")

    # Inferenz-Test mit dem exportierten TFLite-Modell
    if args.test_source.exists():
        n_imgs = len(list(args.test_source.glob("*"))) if args.test_source.is_dir() else 1
        print(f"\nInferenz-Test ({n_imgs} Bild(er), conf={RECOMMENDED_CONF}) …")
        tfl = YOLO(str(dst))
        results = tfl.predict(source=str(args.test_source), imgsz=args.imgsz, conf=RECOMMENDED_CONF, verbose=False)
        dets = sum(len(r.boxes) for r in results)
        imgs_with_det = sum(1 for r in results if len(r.boxes) > 0)
        print(f"  {imgs_with_det}/{len(results)} Bilder mit Detektion, {dets} Boxen gesamt.")
        if dets == 0:
            sys.exit("FEHLER: TFLite-Modell findet nichts - Export/Quantisierung prüfen.")
        print("Inferenz-Test: BESTANDEN ✓")
    else:
        print(f"\nHinweis: Test-Quelle {args.test_source} fehlt - Inferenz-Test übersprungen.")

    print("\nFertig. Übergabe an CBRN-72 (TFLite-Inference in der App).")


if __name__ == "__main__":
    main()
