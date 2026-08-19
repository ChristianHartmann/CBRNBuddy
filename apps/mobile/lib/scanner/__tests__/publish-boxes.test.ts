import type { Point } from 'react-native-vision-camera';

import {
  EMPTY_DEFLICKER,
  MAX_STALE_RESULTS,
  resolveViewBoxes,
  visibleBoxes,
  type IDeflickerState,
  type ISensorBox,
} from '../publish-boxes';

// A converter that maps sensor 0..1 onto a 300x600 view, the simplest possible transform.
const toView = (p: Point): Point => ({ x: p.x * 300, y: p.y * 600 });

const box = (x1: number, y1: number, x2: number, y2: number): ISensorBox => ({
  x1,
  y1,
  x2,
  y2,
  confidence: 0.9,
});

describe('resolveViewBoxes', () => {
  it('converts both corners of every box into a view rectangle', () => {
    const state = resolveViewBoxes([box(0.1, 0.2, 0.5, 0.4)], EMPTY_DEFLICKER, toView);

    expect(state.stale).toBe(0);
    expect(state.boxes).toEqual([{ x: 30, y: 120, width: 120, height: 120 }]);
  });

  it('keeps the previous boxes for a while when nothing is detected', () => {
    const previous: IDeflickerState = { boxes: [{ x: 1, y: 2, width: 3, height: 4 }], stale: 0 };

    const state = resolveViewBoxes([], previous, toView);

    expect(state.boxes).toBe(previous.boxes);
    expect(state.stale).toBe(1);
  });

  it('yields no box at all when the preview cannot convert yet', () => {
    const throwing = (): Point => {
      throw new Error('PreviewView is not ready yet');
    };

    expect(resolveViewBoxes([box(0, 0, 1, 1)], EMPTY_DEFLICKER, throwing)).toEqual(EMPTY_DEFLICKER);
    expect(resolveViewBoxes([box(0, 0, 1, 1)], EMPTY_DEFLICKER, null)).toEqual(EMPTY_DEFLICKER);
  });

  it('never returns a negative width or height even if the transform flips axes', () => {
    const flipping = (p: Point): Point => ({ x: 300 - p.x * 300, y: p.y * 600 });

    const [b] = resolveViewBoxes([box(0.1, 0.2, 0.5, 0.4)], EMPTY_DEFLICKER, flipping).boxes;

    expect(b.width).toBeGreaterThan(0);
    expect(b.height).toBeGreaterThan(0);
    expect(b.x).toBe(150);
  });
});

describe('visibleBoxes', () => {
  it('shows held boxes until the stale limit and hides them after it', () => {
    const boxes = [{ x: 0, y: 0, width: 1, height: 1 }];

    expect(visibleBoxes({ boxes, stale: MAX_STALE_RESULTS - 1 })).toBe(boxes);
    expect(visibleBoxes({ boxes, stale: MAX_STALE_RESULTS })).toEqual([]);
  });
});
