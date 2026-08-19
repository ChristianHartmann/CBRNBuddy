import { render, screen } from '@testing-library/react-native';
import { makeMutable } from 'react-native-reanimated';

import type { IViewBox } from '../../lib/scanner/publish-boxes';
import { MAX_LIVE_BOXES, PlacardOverlay } from '../placard-overlay';

// The reanimated jest mock needs two adjustments for this test, both scoped to this file on
// purpose. Requiring the mock drags in the real react-native-worklets native module, so that
// is stubbed; and the mock's makeMutable is an identity function, so a real {value} object is
// substituted, which is all useAnimatedStyle needs to read from.
jest.mock('react-native-worklets', () => ({
  createSerializable: jest.fn((v: unknown) => v),
  runOnJS: jest.fn((fn: unknown) => fn),
  scheduleOnUI: jest.fn((fn: unknown) => fn),
  isWorkletFunction: jest.fn(() => false),
  RuntimeKind: { NATIVE: 'native', WEB: 'web' },
  serializableMappingCache: new Map(),
}));

jest.mock('react-native-reanimated', () => {
  const Reanimated = jest.requireActual('react-native-reanimated/mock');
  return { ...Reanimated, makeMutable: <T,>(v: T) => ({ value: v }) };
});

describe('PlacardOverlay', () => {
  it('always renders the fixed number of slots, hidden when unused', async () => {
    const boxes = makeMutable<IViewBox[]>([]);

    await render(<PlacardOverlay viewBoxes={boxes} testID="overlay" />);

    for (let i = 0; i < MAX_LIVE_BOXES; i++) {
      expect(screen.getByTestId(`overlay-slot-${i}`)).toHaveStyle({ opacity: 0 });
    }
  });

  it('positions a slot from its view box', async () => {
    const boxes = makeMutable<IViewBox[]>([{ x: 12, y: 34, width: 56, height: 78 }]);

    await render(<PlacardOverlay viewBoxes={boxes} testID="overlay" />);

    expect(screen.getByTestId('overlay-slot-0')).toHaveStyle({
      opacity: 1,
      left: 12,
      top: 34,
      width: 56,
      height: 78,
    });
    expect(screen.getByTestId('overlay-slot-1')).toHaveStyle({ opacity: 0 });
  });
});
