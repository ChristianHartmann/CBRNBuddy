# Training the placard detector

Moved to [docs/training.md](../docs/training.md), together with the dataset toolchain and
the TFLite export.

The scripts in this directory:

| Script | Purpose |
|---|---|
| `generate-synth-data.py` | synthetic placards with YOLO labels |
| `fetch-real-placards.py` | real images from a Roboflow dataset |
| `train-yolo.py` | YOLO26-nano training with an mAP acceptance gate |
| `export-tflite.py` | INT8 export plus size gate and inference test |
| `parse-un-numbers.py` | ADR Table A to substances.json |
| `parse-ericards.py` | ERICards to ericards.json |
| `data_version.py` | content hashes so the app notices a data update |
