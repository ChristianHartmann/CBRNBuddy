import type { Point } from 'react-native-vision-camera';

// The JS half of the live box pipeline. The inference worklet hands over boxes in camera
// sensor coordinates; this turns them into view rectangles and holds them briefly across
// detection gaps. Pure functions, so the whole thing is unit tested without a camera.

export interface ISensorBox {
  // Two corners in camera sensor coordinates as frame.convertFramePointToCameraPoint returns
  // them. Not necessarily 0..1 (vision-camera calls it an "opaque coordinate system"), so
  // they are only ever passed on to the matching view conversion, never interpreted.
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  confidence: number;
}

export interface IViewBox {
  // dp, relative to the camera view
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface IDeflickerState {
  boxes: IViewBox[];
  // Inference cycles since these boxes were last confirmed. Counts inference results, not
  // camera frames: inference runs at roughly 5 to 10 cycles per second, so three empty
  // cycles amount to about 0.3 to 0.6 seconds of afterglow, which removes flicker.
  stale: number;
}

export const MAX_STALE_RESULTS = 3;

export const EMPTY_DEFLICKER: IDeflickerState = { boxes: [], stale: MAX_STALE_RESULTS };

// cameraRef.convertCameraPointToViewPoint, or null while there is no camera to ask.
export type TSensorToView = (p: Point) => Point;

// Any failure yields no box, never a shifted one: a missing or throwing converter (the
// preview throws before its first layout) empties the overlay, and the next cycle simply
// tries again.
export const resolveViewBoxes = (
  detected: ISensorBox[],
  previous: IDeflickerState,
  sensorToView: TSensorToView | null,
): IDeflickerState => {
  if (detected.length === 0) {
    return { boxes: previous.boxes, stale: previous.stale + 1 };
  }
  if (sensorToView == null) {
    return EMPTY_DEFLICKER;
  }
  try {
    const boxes: IViewBox[] = detected.map((b) => {
      const a = sensorToView({ x: b.x1, y: b.y1 });
      const c = sensorToView({ x: b.x2, y: b.y2 });
      // The transform may flip an axis (mirroring, rotation), so normalise the corners.
      const x = Math.min(a.x, c.x);
      const y = Math.min(a.y, c.y);
      return { x, y, width: Math.abs(c.x - a.x), height: Math.abs(c.y - a.y) };
    });
    return { boxes, stale: 0 };
  } catch {
    return EMPTY_DEFLICKER;
  }
};

export const visibleBoxes = (state: IDeflickerState): IViewBox[] =>
  state.stale < MAX_STALE_RESULTS ? state.boxes : [];
