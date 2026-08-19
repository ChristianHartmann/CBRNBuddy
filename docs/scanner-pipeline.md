# The scanner pipeline

How a camera frame becomes a substance. This is the part of the project that took the
longest to get right, so it is documented in more detail than the rest, including the
things that did not work.

## What is being read

An orange ADR plate carries two numbers:

```
┌─────────┐
│   33    │  ← Kemler number, the hazard: 33 means highly flammable liquid
├─────────┤
│  1203   │  ← UN number, the substance: 1203 is petrol
└─────────┘
```

Both matter. The UN number alone does not identify a substance: 570 UN numbers carry
several entries in ADR Table A, and 354 of those differ in hazard class, Kemler number or
packing group. UN 1105, pentanols, is Kemler 33 in packing group II and Kemler 30 in
packing group III. The plate answers which one is on the truck.

## Stage 1: finding the plate

A YOLO26-nano detector, one class, 640x640 input, INT8 quantised, running through
react-native-fast-tflite. NMS is built into the exported graph, so the output is already
`[1, N, 6]`: four box corners, a score and a class per detection.

There are two ways in, and they share nothing but the model file and the post-processing.

### Live preview

vision-camera v5 gives every frame output its own worklet thread. The detection runs on one
of them, the native preview is drawn by CameraX:

```
camera ──┬─► native preview                                  full frame rate
         │
         └─► resizer ──► TFLite ──► boxes ──► shared value   ~5-10 per second
                                      │
                              overlay: plain views on top of the preview
```

The blocking inference only slows its own output down. While it is busy, vision-camera
drops incoming frames for that output natively and the preview keeps running.

**Boxes travel through camera sensor coordinates**, not through pixels. The worklet takes
each box from the model square into frame pixels and asks the frame for the matching sensor
point; the JS side asks the preview where that sensor point is on screen. Both transforms
are CameraX's own, so the preview crop, the rotation and the zoom are accounted for without
a single device constant.

Two things have to be true for that to work, and neither is obvious:

- **The resizer must never be asked to rotate.** Its shader fits the frame into the model
  square before applying the rotation, so at 90 or 270 degrees it fits the wrong aspect
  ratio ([vision-camera#4080](https://github.com/mrousavy/react-native-vision-camera/issues/4080)).
  Measured on a landscape 1280x720 frame, the model got a 1280x405 strip stretched 3.2x
  instead of the centred 720x720 square, and confidence on a placard fell from 0.94 to
  below 0.4. The frame output therefore gets the orientation that cancels the sensor's own
  mounting, which is learned from the first frame; the model input is turned upright in our
  own code afterwards.
- **Physical buffer rotation must stay off.** It would upright the frame just as well, but
  CameraX' `sensorToBufferTransformMatrix` then reports coordinates outside the sensor
  (negative values, measured), and every box lands somewhere else entirely.

An earlier version drew the camera frame itself into a Skia canvas, which made the preview
and the model input the same picture and removed the mapping problem by construction. It
was abandoned: it leaked about 1 MB per preview frame, and every Skia version that freed
the image deadlocked against Hermes from the camera thread. See
`internal_docs/research-live-preview-alternatives.md`.

**Boxes are held briefly after they disappear.** Three inference cycles, roughly half a
second. Without it the box flickers on every frame the model misses.

### Capture

The photo path has its own interpreter on the JS thread, so a capture never has to pause
the preview.

The Android sensor delivers landscape, and YOLO is not rotation invariant, so the photo has
to be uprighted first. Rather than trusting the reported orientation, the code tries the
rotations in order of likelihood and stops at the first detection. If the sign convention
is wrong, nothing is detected in landscape, which is a visible failure rather than a box in
the wrong place.

The plate is then cropped with 14 percent padding. Generous on purpose: a slightly tight
box clips the outer digits, and a clipped digit is not a failed read but a **wrong UN
number**, which is the one failure mode that must not happen quietly.

Below a confidence of 0.4 the crop is skipped and the whole uprighted image goes to OCR. A
false detection cropped tightly is worse than a correct image with more in it.

## Stage 2: reading the numbers

ML Kit text recognition, on device. It returns text blocks with their geometry, which is
what makes the next step possible.

## Stage 3: pairing

`lib/scanner/placard-pairing.ts`. Free of native modules and database access, so the rules
that decide which substance a commander is shown can be tested directly.

Two strategies:

**Geometric pairing.** Two number blocks stacked like a plate: horizontally aligned within
half the wider block's width, vertically within three times the taller block's height. Of
all valid pairs, one that yields a known UN number wins; among equals, the spatially
closest. That last rule matters when two plates are in frame, so a Kemler number from one
is not combined with a UN number from the other.

**Single block.** OCR sometimes returns "331203" as one block. A six or seven character
string splits into a two or three digit Kemler and a four digit UN number when both halves
match their pattern.

Kemler numbers are two or three digits with an optional X prefix; UN numbers are exactly
four digits. Both are validated structurally before the database is consulted.

## Stage 4: the substance

The database confirms whether a UN number exists, and the Kemler number narrows the
variants. The rules:

| Situation | Result |
|---|---|
| Kemler known, matches one variant | that variant |
| Kemler known, matches several | those, most hazardous preselected |
| Kemler known, matches none | **all** variants |
| No Kemler | **all** variants, most hazardous preselected |

The third row is the interesting one. A Kemler number that matches nothing means the
reading was probably wrong, so narrowing on it would hide the right answer. Showing more
than asked for is the recoverable mistake.

Where a preselection is needed, the most hazardous variant wins, ranked by packing group,
I before II before III.

## Confidence

| Value | Meaning |
|---|---|
| 1.0 | geometric pair, UN number known to the database |
| 0.55 | geometric pair, UN number not in the database |
| up to 1.0 | fallback extraction, scored by what was found |
| capped at 0.5 | fallback, UN number not in the database |

A UN number that is not in the database is **never suppressed**, only scored lower. The
database can be incomplete or out of date; a correctly read number the app refuses to show
is the worse outcome, and the commander can still call TUIS with it.

## Failure modes worth knowing

These cost real time. All of them were found on a device, none of them by reading code.

**Channel order.** The raw pixel buffer reports `BGRA` and is actually `ABGR` on the test
device. Read as BGRA, orange came out blue and nothing was detected. Nothing crashed, the
model simply never fired. Found by writing the model input back out as an image and looking
at it, and by checking the maximum raw value, which sat at 0.08 instead of 0.87. iOS may
differ, which is why the offsets are a named constant with the reasoning next to it.

**Lazy image materialisation.** nitro-image `resize()` is lazy. The synchronous
`toRawPixelData()` then returns an empty buffer, and the model dutifully finds nothing in
it. The async variants wait for the GPU to CPU readback.

**Release asset loading.** `require()` on the model resolves over Metro HTTP in
development and does **not** resolve reliably from the bundle in release. The debug build
worked, the release build detected nothing at all. Resolved through expo-asset to a real
`file://` path, which works in both.

**Recreated frame processors.** Passing the device orientation through the worklet
dependencies recreated the frame processor on every rotation, and vision-camera reinstalled
it on the camera thread each time. It accumulated, and the pipeline froze after a handful
of rotations. The orientation goes through a shared value instead, so the processor is
created once.

**Scale sensitivity.** Zoomed in far enough, the plate fills the frame and the model stops
detecting it, because nothing in the training data looks like that. The capture path falls
back to sending the whole uprighted image to OCR, which reads a large clear plate without
help. Multi-scale inference was tried and produced more false positives than it fixed.

**One rotation buffer for the whole session.** Uprighting the model input used to allocate
a fresh 640x640x3 float array every cycle - 4.9 MB, about 25 MB/s at five inferences a
second - because the frame always arrives sideways and the `deg === 0` fast path never
fires. `rotateRgbSquare` now writes into a target the caller owns, and the caller keeps that
target on `globalThis` of the frame output's worklet runtime. A closure cannot hold it: the
serialiser copies captured values and handles neither TypedArrays nor ArrayBuffer, so the
buffer has to be created where it is used.

Measured on the OnePlus 8, release build, 19.08.2026: five minutes of live scanning across
portrait, landscape and upside down produced exactly one `rotation scratch allocated` line
where the old code would have allocated some 750 times. That the line can fire at all was
checked separately - force-stopping the app and starting it again logs one allocation on the
fresh runtime within a second, so a quiet session means reuse and not a dead code path. The
log stays in as the sentinel for exactly that: one line per session is right, one per frame
means `globalThis` stopped carrying the buffer.

The native heap was watched over the same session and shows no growth - it oscillates and
returns to where it started. It is not comparable to the 97 to 121 MB recorded here earlier,
though: that figure was taken under conditions this measurement did not reproduce, so the
memory effect of this change is unproven either way. Only the allocation count is.

The other way out was letting the resizer rotate again - its fit-before-rotate bug is fixed
in the shipped 5.2.2 shader, which swaps the source dimensions for sideways rotations. It
was not taken: it would drop `cancelOrientation` and `orientationSource="custom"`, pull the
photo path along, and tie the box mapping to the library's rotation convention, whose sign
has already misled us once. The rotation we do costs a loop over 1.2 million floats and
nothing else.

Three approaches that do not work at all and should not be retried: `useAsyncRunner`
throws, large buffers cannot cross `scheduleOnRN` because the serialiser handles neither
TypedArrays nor ArrayBuffer, and `model.run()` inside a worklet aborts with SIGABRT.

## Where the code lives

| File | Responsibility |
|---|---|
| `model-source.ts` | resolving the model asset, release safe |
| `use-placard-detector.ts` | live path: worklets, inference, box to sensor coordinates |
| `use-photo-crop.ts` | capture path: upright, detect, crop |
| `detector.ts` | post-processing, geometry, rotation |
| `publish-boxes.ts` | sensor to view on the JS side, plus the deflicker |
| `ocr.ts` | ML Kit adapter |
| `placard-pairing.ts` | the pairing rules, pure |
| `un-lookup.ts` | the only place the scanner touches the database |

`un-lookup.ts` is deliberately the single seam to the substance data. Everything else works
on an injected lookup function, so pointing the scanner at a different source means
replacing one file.
