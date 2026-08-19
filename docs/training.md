# Training the placard detector

The trained model ships with the repository, so this is optional. You need it if you want
to improve the detector, retrain on your own photographs, or follow how it was made.

Training needs a GPU. Google Colab or RunPod is enough; the acceptance run takes well under
an hour on a rented card.

The detector knows exactly one class, `placard_orange`, the orange ADR plate. Diamond
labels and GHS pictograms are a later step and need template artwork first.

## Setup

Two virtual environments, because torch is large and does not belong in the dataset
toolchain:

    python3 -m venv scripts/.venv
    scripts/.venv/bin/pip install -r scripts/requirements.txt

    python3 -m venv scripts/.venv-train
    scripts/.venv-train/bin/pip install -r scripts/requirements-train.txt

Both environments and everything they produce are gitignored.

## 1. Synthetic placards, about 70 percent of the set

    scripts/.venv/bin/python scripts/generate-synth-data.py \
        --count 2100 --out scripts/datasets/warntafeln --draw-check 8

Real photographs of hazmat placards are not available in the thousands, and the ones that
exist cover a narrow range of substances. Generating them solves both: every Kemler and UN
combination that actually exists can be rendered.

- The number pairs come from `apps/mobile/assets/data/substances.json`, filtered to valid
  hazard numbers, which yields around 2,400 pairs. Run the data setup first, see
  [data-sources.md](data-sources.md).
- Augmentation is bounding-box synchronous through albumentations: rotation, perspective,
  brightness and contrast, blur, noise, dirt, partial occlusion.
- `--draw-check N` writes N images with the box drawn in, under `.../_check/`. Look at
  them. A label format mistake is invisible in the numbers and obvious in the picture.
- Backgrounds are generated, never photographs. A photo that happens to contain a real
  placard would appear unlabelled in the background and teach the model that placards are
  not worth detecting.

## 2. Real photographs, about 30 percent

Synthetic data alone produces a model that is good at synthetic data. Real images bring
the things a generator does not think of: reflections, dusk, motion blur, plates at an
angle behind a wet tarpaulin.

    export ROBOFLOW_API_KEY=xxxxx
    scripts/.venv/bin/python scripts/fetch-real-placards.py \
        --workspace <ws> --project <proj> --version <n> \
        --out scripts/datasets/warntafeln

A free account at <https://roboflow.com> gives you an API key. Search
<https://universe.roboflow.com> for a matching dataset, for example "hazmat placard" or
"ADR warntafel"; workspace, project and version are in the Download Dataset dialog.

The script keeps only the placard classes, adjustable through `--keep-classes`, and remaps
them onto class 0. Kaggle sets are often classification only or carry no YOLO boxes;
Roboflow is preferred because its labels arrive ready to use.

Your own photographs work too, as long as they follow the layout below.

## 3. Check the dataset

    for s in train val test; do echo "$s: $(ls scripts/datasets/warntafeln/images/$s | wc -l)"; done

    scripts/datasets/warntafeln/
    ├── images/{train,val,test}/*.jpg
    ├── labels/{train,val,test}/*.txt   # YOLO: "0 xc yc w h", normalised
    └── warntafeln.yaml                 # nc: 1, names: [placard_orange]

## 4. Train

    scripts/.venv-train/bin/python scripts/train-yolo.py \
        --data scripts/datasets/warntafeln/warntafeln.yaml \
        --epochs 100 --imgsz 640

A wrapper around Ultralytics with pre-flight checks and an acceptance gate. Transfer
learning from pretrained `yolo26n.pt`, downloaded on demand. `--device auto` picks CUDA or
MPS when available.

**The gate:** mAP@0.5 above 0.8 on the val split. Below that the script exits non-zero
rather than handing on a model that looks trained. Adjust with `--min-map` if you know
what you are doing.

Output: `scripts/runs/warntafeln/<name>/weights/best.pt` and `metrics.json`.

The plain Ultralytics CLI works too, without the gate:

    yolo detect train data=scripts/datasets/warntafeln/warntafeln.yaml model=yolo26n.pt epochs=100 imgsz=640

## 5. Export to TFLite

    scripts/.venv-train/bin/python scripts/export-tflite.py \
        --weights scripts/runs/warntafeln/yolo26n/weights/best.pt

- INT8 quantisation, calibrated against the generated dataset.
- A size gate under 10 MB and an inference test on the test split run automatically.
- Result: `apps/mobile/assets/models/placard_detector.tflite` plus a `.json` holding the
  class names, `imgsz` and the recommended confidence threshold, which the app reads.
- The first run installs tensorflow, onnx and onnx2tf on demand. It takes a while.

Verify the export in Python before putting it on a phone. Quantisation changes the output
format, and an INT8 model can emit normalised coordinates where the float one emitted
pixels. Finding that out on the device costs an afternoon.

## Licence note

Ultralytics is AGPL-3.0 and treats models trained with it as derived works, which is why
this project is AGPL-3.0 as well. If you retrain and distribute the result, the same
applies to you.
