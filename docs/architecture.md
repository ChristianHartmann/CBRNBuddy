# Architecture

CBRN-Buddy is a single React Native app that works without a network. Everything it needs
is on the device: the substance database, the detection model, the OCR. There is no
server component.

## Why offline

The app is used at incident sites, where mobile coverage is unreliable and time matters.
A lookup that sometimes takes ten seconds and sometimes fails is worse than no lookup at
all, because it cannot be relied on. So the design constraint came first and everything
else followed from it: the model runs on the device, the database ships with the app, and
the only network access left is map tiles.

## Layers

```
app/            Expo Router screens. No business logic beyond wiring.
components/     Reusable views. components/ui/ holds the primitives every screen builds on.
lib/            The behaviour.
  calculations/ Deterministic, tested against published reference values.
  database/     SQLite: schema, migrations, seeding, queries.
  scanner/      Detection, OCR, the rules that turn pixels into a substance.
  stores/       Zustand state that outlives a screen.
constants/      Colours and hazard class reference data.
assets/         The model file and the seed data.
```

Dependencies point one way: `app/` uses `components`, `lib` and `constants`; `lib` never
imports from `app`; `constants` imports nothing.

## The scan, end to end

```
camera frame
  │
  │  vision-camera v5 frame output, own worklet thread
  ▼
resizer ──► 640x640 float32 RGB ──► TFLite (YOLO26-nano, INT8) ──► boxes
  │                                                                 │
  │  boxes to sensor coordinates, overlay on the native preview     │
  ▼                                                                 ▼
live preview                                            shutter pressed
                                                                    │
                                          photo, own interpreter on the JS thread
                                                                    ▼
                                          upright ──► detect ──► crop to the placard
                                                                    │
                                                          ML Kit text recognition
                                                                    ▼
                                          geometric pairing: Kemler above, UN below
                                                                    │
                                                  substance lookup, Kemler resolves
                                                  which variant is on the truck
                                                                    ▼
                                                          ERICard and measures
```

Two details that are easy to miss and expensive to rediscover:

**Boxes are placed through camera sensor coordinates.** The live view is CameraX' own
preview with plain views drawn over it. A box goes from the model square into frame pixels,
from there into sensor coordinates, and from there onto the screen, using the two transforms
CameraX provides. Preview crop, rotation and zoom are therefore accounted for without a
single device constant. Two library defaults have to be changed for this to hold; both are
documented in `docs/scanner-pipeline.md` and neither is guessable from the code.

**Live and photo are separate paths.** They share the model file and the post-processing
in `lib/scanner/detector.ts`, nothing else. The live path lives in worklets on the camera
thread, the photo path on the JS thread with its own interpreter. Two interpreters, so a
capture does not have to pause the preview.

## The model

| | |
|---|---|
| Architecture | YOLO26-nano, single class `placard_orange` |
| Input | 640x640, RGB, float32 |
| Quantisation | INT8, under 10 MB |
| NMS | built into the exported graph, output `[1, N, 6]` |
| Confidence threshold | 0.25 |
| Runtime | react-native-fast-tflite |

Training data is roughly 70 percent synthetic placards generated from the real Kemler and
UN pairs, plus real photographs. See [training.md](training.md).

The model is not rotation invariant. On a turned phone the placard would sit sideways in
the frame and go undetected, so the model input is rotated to the physical device
orientation before inference and the resulting box is rotated back. The interface stays
locked to portrait.

## Data

Two datasets are seeded into SQLite on first start:

- **substances** from ADR Table A, about 3,300 entries. 570 UN numbers carry more than one
  entry, and 354 of those differ in hazard class, Kemler number or packing group, so a UN
  number alone does not identify a substance. The Kemler number from the placard resolves
  it.
- **ericards** from CEFIC, about 2,300 cards. 206 UN numbers carry several, with no field
  that maps a card onto a specific variant, so all of them are offered.

Substance search runs through an FTS5 index, with a LIKE query as fallback. A digit string
is answered as both a UN number and a Kemler number, because on a placard it could be
either.

Neither dataset ships with the repository. See [data-sources.md](data-sources.md) for how
to assemble them and under which terms.

### Keeping the data current

The seed files carry a content hash in `assets/data/data-version.json`, written by the
parser scripts. On start the app compares it against the version stored in the database
and reloads everything when they differ. An update replaces rather than merges: a
substance can change its class, and merging would leave the superseded values in place.

## Safety rules that shaped the code

- Calculations are deterministic and tested against published reference values. Nothing
  safety relevant is inferred or generated.
- Every calculated figure names its source in the interface.
- When an input is unusable, the conservative reading wins. An empty quantity field yields
  the large spill radius, not the small one.
- A reading the database does not recognise is still shown. Hiding a correctly read UN
  number because it is missing locally would be the worse failure.
