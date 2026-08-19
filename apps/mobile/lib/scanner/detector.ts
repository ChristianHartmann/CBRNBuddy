// CBRN-72 (stage 2): post-processing for the YOLO26-nano TFLite detection (class
// placard_orange).
//
// Pure, worklet-capable functions, since they run inside the vision-camera frame processor
// worklet: plain for loops, no external closures, no `any`. Under Jest the 'worklet'
// directive is a harmless no-op string, so these are directly unit testable.
//
// Model: one class, imgsz 640. The Ultralytics detect output is either channels-first
// [1, 5, 8400] (4 bbox + 1 score over N anchors) or channels-last [1, 8400, 5]. Box format
// is xywh (centre, in 640 pixel coordinates). NMS is applied here, not inside the model.

export interface IDetection {
  x: number; // Zentrum x, 640er-Raum
  y: number; // Zentrum y, 640er-Raum
  w: number;
  h: number;
  confidence: number;
}

export interface IBox {
  x: number; // linke obere Ecke, Zielbild-Raum
  y: number;
  width: number;
  height: number;
  confidence: number;
}

// Upright frame buffer dimensions in pixels, used for the geometric box mapping in the overlay.
export interface IFrameSize {
  w: number;
  h: number;
}

export interface IQuant {
  scale: number;
  zeroPoint: number;
}

export type TensorData = Float32Array | Int8Array | Uint8Array;

const FEATURE_LEN = 5; // cx, cy, w, h, score (1 Klasse)

const dequant = (v: number, quant: IQuant | null): number => {
  'worklet';
  return quant ? (v - quant.zeroPoint) * quant.scale : v;
};

// parseOutput and nms are the path for models WITHOUT built-in NMS (raw YOLO head,
// [1,5,N] or [1,N,5]). The currently deployed model has NMS built in (output [1,N,6]) and
// uses parseDetections6. These are kept, and unit tested, in case of a re-export without
// NMS; see scripts/export-tflite.py.
//
// Convert the raw output tensor into detections above the confidence threshold (640 space).
// Detects the [1,5,N] versus [1,N,5] layout from the shape; an unknown format yields [].
export const parseOutput = (
  raw: TensorData,
  shape: readonly number[],
  quant: IQuant | null,
  confThreshold: number,
): IDetection[] => {
  'worklet';
  const detections: IDetection[] = [];
  if (shape.length !== 3) {
    return detections;
  }
  const a = shape[1];
  const b = shape[2];

  // The axis of length 5 is the feature axis. a===5 means channels-first [1,5,N], otherwise
  // b===5 means [1,N,5]. When N==5 the shape is ambiguous and channels-first wins, which is
  // the Ultralytics default.
  let channelsFirst = false;
  let n = 0;
  if (a === FEATURE_LEN) {
    channelsFirst = true; // [1, 5, N]
    n = b;
  } else if (b === FEATURE_LEN) {
    channelsFirst = false; // [1, N, 5]
    n = a;
  } else {
    return detections; // unerwartetes Format (z. B. eingebautes NMS) → Aufrufer loggt die Shape
  }

  for (let i = 0; i < n; i++) {
    let cx: number;
    let cy: number;
    let w: number;
    let h: number;
    let score: number;
    if (channelsFirst) {
      cx = dequant(raw[0 * n + i], quant);
      cy = dequant(raw[1 * n + i], quant);
      w = dequant(raw[2 * n + i], quant);
      h = dequant(raw[3 * n + i], quant);
      score = dequant(raw[4 * n + i], quant);
    } else {
      const base = i * FEATURE_LEN;
      cx = dequant(raw[base], quant);
      cy = dequant(raw[base + 1], quant);
      w = dequant(raw[base + 2], quant);
      h = dequant(raw[base + 3], quant);
      score = dequant(raw[base + 4], quant);
    }
    if (score >= confThreshold && w > 0 && h > 0) {
      detections.push({ x: cx, y: cy, w, h, confidence: score });
    }
  }
  return detections;
};

// Parser for models with built-in NMS: output [1, N, 6], for example [1,300,6].
// Six values per detection: x1, y1, x2, y2, score, class (xyxy corners). NMS already ran
// inside the model, so nms() is not needed. Returns IDetection (xywh centre) in the same
// coordinate space as the box values; confirm 0..640 versus normalised 0..1 from the raw
// values on the device.
export const parseDetections6 = (
  raw: TensorData,
  shape: readonly number[],
  quant: IQuant | null,
  confThreshold: number,
): IDetection[] => {
  'worklet';
  const detections: IDetection[] = [];
  if (shape.length !== 3 || shape[2] < 5) {
    return detections;
  }
  const n = shape[1];
  const stride = shape[2];
  for (let i = 0; i < n; i++) {
    const b = i * stride;
    const x1 = dequant(raw[b], quant);
    const y1 = dequant(raw[b + 1], quant);
    const x2 = dequant(raw[b + 2], quant);
    const y2 = dequant(raw[b + 3], quant);
    const score = dequant(raw[b + 4], quant);
    if (score < confThreshold) {
      continue;
    }
    const w = x2 - x1;
    const h = y2 - y1;
    if (w > 0 && h > 0) {
      detections.push({ x: x1 + w / 2, y: y1 + h / 2, w, h, confidence: score });
    }
  }
  return detections;
};

const iou = (a: IDetection, b: IDetection): number => {
  'worklet';
  const ax1 = a.x - a.w / 2;
  const ay1 = a.y - a.h / 2;
  const ax2 = a.x + a.w / 2;
  const ay2 = a.y + a.h / 2;
  const bx1 = b.x - b.w / 2;
  const by1 = b.y - b.h / 2;
  const bx2 = b.x + b.w / 2;
  const by2 = b.y + b.h / 2;

  const ix1 = ax1 > bx1 ? ax1 : bx1;
  const iy1 = ay1 > by1 ? ay1 : by1;
  const ix2 = ax2 < bx2 ? ax2 : bx2;
  const iy2 = ay2 < by2 ? ay2 : by2;

  const iw = ix2 - ix1;
  const ih = iy2 - iy1;
  if (iw <= 0 || ih <= 0) {
    return 0;
  }
  const inter = iw * ih;
  const areaA = a.w * a.h;
  const areaB = b.w * b.h;
  const union = areaA + areaB - inter;
  return union <= 0 ? 0 : inter / union;
};

// Greedy non-maximum suppression: sort by confidence descending once, then a single pass.
// The highest confidence wins and overlapping boxes are dropped. Result stays sorted.
export const nms = (dets: IDetection[], iouThreshold: number): IDetection[] => {
  'worklet';
  const n = dets.length;
  const order: number[] = [];
  for (let i = 0; i < n; i++) {
    order.push(i);
  }
  order.sort((a, b) => dets[b].confidence - dets[a].confidence);

  const suppressed: boolean[] = [];
  for (let i = 0; i < n; i++) {
    suppressed.push(false);
  }
  const result: IDetection[] = [];
  for (let oi = 0; oi < n; oi++) {
    const idx = order[oi];
    if (suppressed[idx]) {
      continue;
    }
    result.push(dets[idx]);
    for (let oj = oi + 1; oj < n; oj++) {
      const jdx = order[oj];
      if (!suppressed[jdx] && iou(dets[idx], dets[jdx]) > iouThreshold) {
        suppressed[jdx] = true;
      }
    }
  }
  return result;
};

// Detection (xywh centre) to a box in the target image (top left corner plus size), clamped.
// `fromSize` is the coordinate reference of the detection: 640 for pixel based output, the
// Ultralytics float default, or 1 if the model emits normalised coordinates. Which one
// applies was pinned down against the real model output during wiring.
// Assumes a stretch resize onto the model square, hence independent x/y scaling.
export const mapToOriginal = (
  det: IDetection,
  fromSize: number,
  toWidth: number,
  toHeight: number,
): IBox => {
  'worklet';
  const sx = toWidth / fromSize;
  const sy = toHeight / fromSize;
  let x = (det.x - det.w / 2) * sx;
  let y = (det.y - det.h / 2) * sy;
  let width = det.w * sx;
  let height = det.h * sy;

  if (x < 0) {
    width += x;
    x = 0;
  }
  if (y < 0) {
    height += y;
    y = 0;
  }
  if (x + width > toWidth) {
    width = toWidth - x;
  }
  if (y + height > toHeight) {
    height = toHeight - y;
  }
  // Boxes whose centre lies outside the image can go negative, so clamp to 0.
  if (width < 0) {
    width = 0;
  }
  if (height < 0) {
    height = 0;
  }
  return { x, y, width, height, confidence: det.confidence };
};

// Visible source region under a 'cover' layout, where the source fills the destination and
// the overhang is cropped: a shared scale s = max(dstW/srcW, dstH/srcH), after which only
// the fraction (dstAxis/s)/srcAxis of the source is visible per axis, centred.
// Returns the offset (ox/oy) and the visible fraction (sx/sy) in normalised source
// coordinates. Used by boxToFrameCorners to undo the resizer's cut of the model square.
interface ICoverVisible {
  ox: number;
  oy: number;
  sx: number;
  sy: number;
}

export const coverVisible = (
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): ICoverVisible => {
  'worklet';
  const s = Math.max(dstW / srcW, dstH / srcH);
  const sx = dstW / s / srcW;
  const sy = dstH / s / srcH;
  return { ox: (1 - sx) / 2, oy: (1 - sy) / 2, sx, sy };
};

export interface IFrameCorners {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// Undo the resizer's 'cover' cut: a box normalised 0..1 in the 640 model square becomes two
// corners in frame pixels. This is the last piece of geometry that is ours; from frame pixels
// onward CameraX's transforms take over (frame -> sensor -> view). Clamped, so a box that
// overhangs the frame can never produce coordinates the transforms were not built for.
export const boxToFrameCorners = (box: IBox, frameW: number, frameH: number): IFrameCorners => {
  'worklet';
  const c = coverVisible(frameW, frameH, 1, 1);
  const clampX = (v: number): number => (v < 0 ? 0 : v > frameW ? frameW : v);
  const clampY = (v: number): number => (v < 0 ? 0 : v > frameH ? frameH : v);
  const x1 = clampX((c.ox + box.x * c.sx) * frameW);
  const y1 = clampY((c.oy + box.y * c.sy) * frameH);
  const x2 = clampX((c.ox + (box.x + box.width) * c.sx) * frameW);
  const y2 = clampY((c.oy + (box.y + box.height) * c.sy) * frameH);
  return { x1, y1, x2, y2 };
};

// Orientation: the live frame is interface-upright, because the inference frame output
// requests enablePhysicalBufferRotation and the app is locked to portrait. Turning the phone
// therefore puts the placard sideways in the frame, and YOLO is not rotation invariant, so
// nothing is detected. The fix is to rotate the model input to the PHYSICAL device orientation
// (useOrientation('device')) before inference and rotate the resulting box back afterwards.
// The UI stays portrait while the scanner works in any position.

export type TCameraOrientation = 'up' | 'right' | 'down' | 'left';

// Device orientation to the clockwise degrees by which the interface-upright frame must be
// rotated for its content to be gravity-upright. Same convention as the photo path's best
// guess (up 0, left 90, right 270, down 180). A wrong left/right assignment simply means
// nothing is detected in landscape, never a misplaced box, in which case swap 90 and 270.
export const orientationToDegrees = (o: TCameraOrientation | undefined): number => {
  'worklet';
  if (o === 'left') {
    return 90;
  }
  if (o === 'right') {
    return 270;
  }
  if (o === 'down') {
    return 180;
  }
  return 0;
};

const ORIENTATIONS: readonly TCameraOrientation[] = ['up', 'right', 'down', 'left'];

// The output orientation that makes frames arrive unrotated, given the orientation a frame
// reports while the output still sits at its default 'up'.
//
// A frame's orientation is the sum of the sensor's own mounting and the output's target, in
// quarter turns: measured on the device, output 'up' yields frame 'left', and output 'left'
// yields frame 'down'. So the frame reports the sensor mounting as long as the output is 'up',
// and the value that cancels it is its complement to a full turn.
//
// This matters because the resizer must never be asked to rotate: its shader fits the frame
// into the model square before applying the rotation, so at 90 or 270 degrees it fits the wrong
// aspect ratio (react-native-vision-camera#4080). Deriving the value rather than writing 'right'
// into the source keeps that working on a device whose sensor is mounted differently.
export const cancelOrientation = (o: TCameraOrientation): TCameraOrientation => {
  const index = ORIENTATIONS.indexOf(o);
  return ORIENTATIONS[(ORIENTATIONS.length - index) % ORIENTATIONS.length];
};

// Rotate a square RGB image (size x size x 3, NHWC interleaved float32) by deg (90, 180 or
// 270 clockwise) into out, which the caller owns and may hand in again. The live path does
// exactly that: one buffer for the whole session instead of 4.9 MB of garbage per inference.
// Any other deg copies src into out, so the function is total and out is always the answer.
// Uses inverse mapping, determining the source for each target pixel, with a single branch
// outside the loop.
export const rotateRgbSquare = (
  src: Float32Array,
  out: Float32Array,
  size: number,
  deg: number,
): void => {
  'worklet';
  if (deg !== 90 && deg !== 180 && deg !== 270) {
    out.set(src);
    return;
  }
  const last = size - 1;
  if (deg === 90) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const s = ((last - x) * size + y) * 3;
        const d = (y * size + x) * 3;
        out[d] = src[s];
        out[d + 1] = src[s + 1];
        out[d + 2] = src[s + 2];
      }
    }
  } else if (deg === 180) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const s = ((last - y) * size + (last - x)) * 3;
        const d = (y * size + x) * 3;
        out[d] = src[s];
        out[d + 1] = src[s + 1];
        out[d + 2] = src[s + 2];
      }
    }
  } else {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const s = (x * size + (last - y)) * 3;
        const d = (y * size + x) * 3;
        out[d] = src[s];
        out[d + 1] = src[s + 1];
        out[d + 2] = src[s + 2];
      }
    }
  }
};

// Rotate a normalised box (0..1) from the model space G, rotated by deg, back into the
// interface-upright frame space P. Exact inverse of rotateRgbSquare, which is what puts the
// box back into the space boxToFrameCorners expects, on its way to sensor coordinates. At
// multiples of 90 degrees the rectangle stays axis aligned, so the two opposite corners
// suffice.
export const rotateBoxNorm = (b: IBox, deg: number): IBox => {
  'worklet';
  if (deg !== 90 && deg !== 180 && deg !== 270) {
    return b;
  }
  const x1 = b.x;
  const y1 = b.y;
  const x2 = b.x + b.width;
  const y2 = b.y + b.height;
  let ax: number;
  let ay: number;
  let bx: number;
  let by: number;
  if (deg === 90) {
    // (gx,gy) → (gy, 1-gx)
    ax = y1;
    ay = 1 - x1;
    bx = y2;
    by = 1 - x2;
  } else if (deg === 180) {
    ax = 1 - x1;
    ay = 1 - y1;
    bx = 1 - x2;
    by = 1 - y2;
  } else {
    // 270: (gx,gy) → (1-gy, gx)
    ax = 1 - y1;
    ay = x1;
    bx = 1 - y2;
    by = x2;
  }
  const minx = ax < bx ? ax : bx;
  const maxx = ax < bx ? bx : ax;
  const miny = ay < by ? ay : by;
  const maxy = ay < by ? by : ay;
  return { x: minx, y: miny, width: maxx - minx, height: maxy - miny, confidence: b.confidence };
};
