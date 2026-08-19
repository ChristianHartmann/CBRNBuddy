import {
  parseOutput,
  parseDetections6,
  nms,
  mapToOriginal,
  orientationToDegrees,
  cancelOrientation,
  rotateRgbSquare,
  rotateBoxNorm,
  boxToFrameCorners,
  type IDetection,
  type IBox,
} from '../detector';

// Helper: write two detections (cx,cy,w,h,score) into a channels-first [1,5,N] buffer.
const buildChannelsFirst = (rows: number[][]): { raw: Float32Array; shape: number[] } => {
  const n = rows.length;
  const raw = new Float32Array(5 * n);
  for (let i = 0; i < n; i++) {
    raw[0 * n + i] = rows[i][0];
    raw[1 * n + i] = rows[i][1];
    raw[2 * n + i] = rows[i][2];
    raw[3 * n + i] = rows[i][3];
    raw[4 * n + i] = rows[i][4];
  }
  return { raw, shape: [1, 5, n] };
};

const buildChannelsLast = (rows: number[][]): { raw: Float32Array; shape: number[] } => {
  const n = rows.length;
  const raw = new Float32Array(5 * n);
  for (let i = 0; i < n; i++) {
    raw[i * 5 + 0] = rows[i][0];
    raw[i * 5 + 1] = rows[i][1];
    raw[i * 5 + 2] = rows[i][2];
    raw[i * 5 + 3] = rows[i][3];
    raw[i * 5 + 4] = rows[i][4];
  }
  return { raw, shape: [1, n, 5] };
};

const ROWS: number[][] = [
  [320, 320, 100, 80, 0.9], // strong detection
  [100, 100, 40, 40, 0.1], // below the threshold
  [500, 400, 60, 60, 0.5], // above the threshold
];

describe('parseOutput', () => {
  it('reads channels-first [1,5,N] and filters by confidence', () => {
    const { raw, shape } = buildChannelsFirst(ROWS);
    const dets = parseOutput(raw, shape, null, 0.25);
    expect(dets).toHaveLength(2);
    // Integer coordinates are exact in float32, a confidence of 0.9 is not, hence toBeCloseTo.
    expect(dets[0]).toMatchObject({ x: 320, y: 320, w: 100, h: 80 });
    expect(dets[0].confidence).toBeCloseTo(0.9, 5);
    expect(dets[1]).toMatchObject({ x: 500, y: 400 });
    expect(dets[1].confidence).toBeCloseTo(0.5, 5);
  });

  it('returns the same detections for channels-last [1,N,5]', () => {
    const cf = buildChannelsFirst(ROWS);
    const first = parseOutput(cf.raw, cf.shape, null, 0.25);
    const cl = buildChannelsLast(ROWS);
    const last = parseOutput(cl.raw, cl.shape, null, 0.25);
    expect(last).toEqual(first);
  });

  it('dequantises INT8 values for coordinates as well as the score', () => {
    const scale = 1 / 255;
    const zeroPoint = -128;
    // With this quantisation every dequantised value lands in 0..1 for raw -128..127. Such a
    // model emits NORMALISED coordinates, so the caller maps with fromSize=1.
    const lin = new Int8Array([0, 0, 0, 0, 102]); // cx,cy,w,h roh=0 → 0.502; score roh=102 → 0.902
    const dets = parseOutput(lin, [1, 5, 1], { scale, zeroPoint }, 0.25);
    expect(dets).toHaveLength(1);
    expect(dets[0].x).toBeCloseTo((0 - zeroPoint) * scale, 5); // 128/255 ≈ 0.502
    expect(dets[0].w).toBeCloseTo(0.502, 2);
    expect(dets[0].confidence).toBeCloseTo((102 - zeroPoint) * scale, 5);
    expect(dets[0].confidence).toBeCloseTo(0.902, 2);
  });

  it('returns [] for an unexpected output format', () => {
    const raw = new Float32Array(6);
    expect(parseOutput(raw, [1, 2, 3], null, 0.25)).toEqual([]);
    expect(parseOutput(raw, [1, 6], null, 0.25)).toEqual([]);
  });
});

describe('parseDetections6', () => {
  it('reads [1,N,6] (xyxy plus score plus class), filters by confidence, returns the xywh centre', () => {
    // Two detections: the first above the threshold, the second below.
    const raw = new Float32Array([
      100, 100, 200, 180, 0.9, 0, // x1,y1,x2,y2,score,class → w=100,h=80, center (150,140)
      300, 300, 360, 360, 0.1, 0, // below the threshold
    ]);
    const dets = parseDetections6(raw, [1, 2, 6], null, 0.25);
    expect(dets).toHaveLength(1);
    expect(dets[0]).toMatchObject({ x: 150, y: 140, w: 100, h: 80 });
    expect(dets[0].confidence).toBeCloseTo(0.9, 5);
  });

  it('discards boxes with a non-positive width or height', () => {
    const raw = new Float32Array([200, 200, 100, 100, 0.9, 0]); // x2<x1 → w<0
    expect(parseDetections6(raw, [1, 1, 6], null, 0.25)).toEqual([]);
  });
});

describe('nms', () => {
  it('suppresses heavily overlapping boxes and keeps the most confident one', () => {
    const dets: IDetection[] = [
      { x: 100, y: 100, w: 50, h: 50, confidence: 0.9 },
      { x: 105, y: 102, w: 50, h: 50, confidence: 0.7 }, // overlaps heavily, so it is dropped
      { x: 400, y: 400, w: 50, h: 50, confidence: 0.8 }, // separat → bleibt
    ];
    const kept = nms(dets, 0.45);
    expect(kept).toHaveLength(2);
    expect(kept[0].confidence).toBe(0.9);
    expect(kept[1].confidence).toBe(0.8);
  });

  it('leaves non-overlapping boxes untouched', () => {
    const dets: IDetection[] = [
      { x: 0, y: 0, w: 10, h: 10, confidence: 0.6 },
      { x: 500, y: 500, w: 10, h: 10, confidence: 0.5 },
    ];
    expect(nms(dets, 0.45)).toHaveLength(2);
  });
});

describe('mapToOriginal', () => {
  it('scales a 640 detection to the target resolution and returns the top left corner', () => {
    const det: IDetection = { x: 320, y: 320, w: 64, h: 64, confidence: 0.9 };
    const box = mapToOriginal(det, 640, 1280, 960);
    // sx=2, sy=1.5 gives centre (640,480), size (128,96), corner (576,432)
    expect(box).toEqual({ x: 576, y: 432, width: 128, height: 96, confidence: 0.9 });
  });

  it('clamps boxes to the image bounds', () => {
    const det: IDetection = { x: 0, y: 0, w: 100, h: 100, confidence: 0.5 };
    const box = mapToOriginal(det, 640, 640, 640);
    expect(box.x).toBe(0);
    expect(box.y).toBe(0);
    expect(box.width).toBe(50); // 100/2 ragte negativ → auf 50 geklemmt
    expect(box.height).toBe(50);
  });

  it('never returns a negative width or height when the centre lies outside the image', () => {
    const det: IDetection = { x: -50, y: 320, w: 20, h: 20, confidence: 0.5 };
    const box = mapToOriginal(det, 640, 640, 640);
    expect(box.width).toBeGreaterThanOrEqual(0);
    expect(box.height).toBeGreaterThanOrEqual(0);
  });
});

describe('orientationToDegrees', () => {
  it('maps device orientation to the uprighting rotation (up/undefined 0, left 90, right 270, down 180)', () => {
    expect(orientationToDegrees('up')).toBe(0);
    expect(orientationToDegrees(undefined)).toBe(0);
    expect(orientationToDegrees('left')).toBe(90);
    expect(orientationToDegrees('right')).toBe(270);
    expect(orientationToDegrees('down')).toBe(180);
  });
});

describe('cancelOrientation', () => {
  // Measured on the device: with the output at its default 'up' the frame reported 'left', and
  // setting the output to 'right' made the frame arrive 'up'.
  it('returns the output orientation that cancels the sensor mounting', () => {
    expect(cancelOrientation('left')).toBe('right');
    expect(cancelOrientation('right')).toBe('left');
    expect(cancelOrientation('down')).toBe('down');
    expect(cancelOrientation('up')).toBe('up');
  });

  it('always yields an orientation that sums to a full turn', () => {
    const quarters = { up: 0, right: 1, down: 2, left: 3 } as const;
    for (const o of ['up', 'right', 'down', 'left'] as const) {
      expect((quarters[o] + quarters[cancelOrientation(o)]) % 4).toBe(0);
    }
  });
});

describe('rotateRgbSquare', () => {
  // 2x2 RGB image, R channel carries the pixel value, G and B are 0. NHWC interleaved,
  // index (row*2+col)*3.
  const img2x2 = (): Float32Array =>
    new Float32Array([1, 0, 0, 2, 0, 0, 3, 0, 0, 4, 0, 0]); // P = 1 2 / 3 4

  const empty = (): Float32Array => new Float32Array(12);

  it('copies the source unchanged when deg asks for no rotation', () => {
    const out = empty();
    rotateRgbSquare(img2x2(), out, 2, 0);
    expect(Array.from(out)).toEqual(Array.from(img2x2()));
  });

  it('rotates a 2x2 image clockwise by 90 degrees (1 2 / 3 4 -> 3 1 / 4 2)', () => {
    const out = empty();
    rotateRgbSquare(img2x2(), out, 2, 90);
    expect([out[0], out[3], out[6], out[9]]).toEqual([3, 1, 4, 2]); // R channel per pixel
  });

  it('returns to the original after four 90 degree rotations', () => {
    let cur = img2x2();
    for (let i = 0; i < 4; i++) {
      const out = empty();
      rotateRgbSquare(cur, out, 2, 90);
      cur = out;
    }
    expect(Array.from(cur)).toEqual(Array.from(img2x2()));
  });

  // The whole point of the out parameter: the live path hands in one buffer for every
  // inference instead of allocating 640x640x3 floats per frame.
  it('fills the same target on repeated calls without allocating', () => {
    const out = empty();
    rotateRgbSquare(img2x2(), out, 2, 90);
    const after90 = Array.from(out);
    rotateRgbSquare(img2x2(), out, 2, 180);
    expect(Array.from(out)).not.toEqual(after90);
    expect([out[0], out[3], out[6], out[9]]).toEqual([4, 3, 2, 1]);
  });
});

describe('rotateBoxNorm (exact inverse of rotateRgbSquare)', () => {
  const SIZE = 8;

  // size x size x 3 with a SINGLE bright pixel (R=1) at (col,row).
  const imgWithPixel = (col: number, row: number): Float32Array => {
    const a = new Float32Array(SIZE * SIZE * 3);
    a[(row * SIZE + col) * 3] = 1;
    return a;
  };

  const findPixel = (a: Float32Array): { col: number; row: number } => {
    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        if (a[(row * SIZE + col) * 3] > 0.5) {
          return { col, row };
        }
      }
    }
    throw new Error('kein heller Pixel gefunden');
  };

  it('is the identity at deg=0', () => {
    const b: IBox = { x: 0.1, y: 0.2, width: 0.3, height: 0.4, confidence: 0.9 };
    expect(rotateBoxNorm(b, 0)).toEqual(b);
  });

  it('keeps a centred box at (0.5,0.5) for every rotation', () => {
    const b: IBox = { x: 0.4, y: 0.4, width: 0.2, height: 0.2, confidence: 0.9 };
    for (const deg of [90, 180, 270]) {
      const r = rotateBoxNorm(b, deg);
      expect(r.x + r.width / 2).toBeCloseTo(0.5, 6);
      expect(r.y + r.height / 2).toBeCloseTo(0.5, 6);
    }
  });

  it('maps a box found in the rotated image back onto the original (round trip)', () => {
    // Rotate the image from P to G, locate the bright pixel in G, then rotate its cell box
    // back with rotateBoxNorm: it must land on the ORIGINAL cell. This verifies the box lines
    // up in the canvas (P) no matter how the phone is held.
    const cells: readonly (readonly [number, number])[] = [
      [0, 0],
      [SIZE - 1, 0],
      [0, SIZE - 1],
      [2, 5],
    ];
    for (const [col, row] of cells) {
      for (const deg of [90, 180, 270]) {
        const g = new Float32Array(SIZE * SIZE * 3);
        rotateRgbSquare(imgWithPixel(col, row), g, SIZE, deg);
        const p = findPixel(g);
        const boxG: IBox = {
          x: p.col / SIZE,
          y: p.row / SIZE,
          width: 1 / SIZE,
          height: 1 / SIZE,
          confidence: 1,
        };
        const boxP = rotateBoxNorm(boxG, deg);
        expect(boxP.x).toBeCloseTo(col / SIZE, 6);
        expect(boxP.y).toBeCloseTo(row / SIZE, 6);
        expect(boxP.width).toBeCloseTo(1 / SIZE, 6);
        expect(boxP.height).toBeCloseTo(1 / SIZE, 6);
      }
    }
  });
});

describe('boxToFrameCorners', () => {
  // The model sees a 640 square cut 'cover' out of the frame. Undoing that cut is the only
  // geometry left on our side; everything after it is CameraX's job.
  it('keeps a centred box centred on a 16:9 frame', () => {
    const box: IBox = { x: 0.4, y: 0.4, width: 0.2, height: 0.2, confidence: 1 };

    const c = boxToFrameCorners(box, 1280, 720);

    expect((c.x1 + c.x2) / 2).toBeCloseTo(640, 5);
    expect((c.y1 + c.y2) / 2).toBeCloseTo(360, 5);
  });

  it('maps the full square onto the visible centre crop of a 4:3 frame', () => {
    const box: IBox = { x: 0, y: 0, width: 1, height: 1, confidence: 1 };

    const c = boxToFrameCorners(box, 1600, 1200);

    // cover of a square into 1600x1200: the square shows the middle 1200x1200 of the frame
    expect(c.x1).toBeCloseTo(200, 5);
    expect(c.x2).toBeCloseTo(1400, 5);
    expect(c.y1).toBeCloseTo(0, 5);
    expect(c.y2).toBeCloseTo(1200, 5);
  });

  it('clamps a box that overhangs the frame', () => {
    // On 16:9 the square covers the middle 56 percent of the width, so a box has to reach
    // well past the square's edge before it actually leaves the frame: -0.6 maps to -152 px.
    const box: IBox = { x: -0.6, y: 0.9, width: 0.5, height: 0.5, confidence: 1 };

    const c = boxToFrameCorners(box, 1280, 720);

    expect(c.x1).toBe(0);
    expect(c.y2).toBe(720);
    expect(c.x1).toBeLessThanOrEqual(c.x2);
    expect(c.y1).toBeLessThanOrEqual(c.y2);
  });
});
