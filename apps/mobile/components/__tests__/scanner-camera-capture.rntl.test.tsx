import { act, render, screen, userEvent } from '@testing-library/react-native';

import { LiveScannerCamera, MAX_ZOOM_LIVE, MAX_ZOOM_PHOTO } from '../live-scanner-camera';

// The sensor hands out a landscape photo regardless of how the phone is held, so every capture
// has to be uprighted physically before it is shown or read. In live mode detectAndCrop does
// that on the way to the placard crop. Photo mode has no crop to hide behind and needs the same
// uprighting on its own, otherwise the picture arrives 90 degrees over - visibly in the result
// overlay, and invisibly wrong for OCR.
const mockDetectAndCrop = jest.fn(async () => 'file:///tmp/cropped.jpg');
const mockUprightPhoto = jest.fn(async () => 'file:///tmp/upright.jpg');

jest.mock('../../lib/scanner/use-photo-crop', () => ({
  usePhotoCrop: () => ({
    detectAndCrop: mockDetectAndCrop,
    uprightPhoto: mockUprightPhoto,
  }),
}));

jest.mock('../../lib/scanner/use-placard-detector', () => ({
  usePlacardDetector: () => ({
    inferenceOutput: {},
    viewBoxes: { value: [] },
    isReady: true,
  }),
}));

// This suite only exercises capture and zoom, never the drawn boxes, so the overlay itself is
// stubbed out: pulling in the real component would drag in react-native-reanimated's native
// worklets module, which is not initialised in this test environment.
jest.mock('../placard-overlay', () => {
  const { View } = jest.requireActual('react-native');
  return { PlacardOverlay: () => <View testID="placard-overlay" /> };
});

// Overridden per test; reset in beforeEach. Device zoom ceiling and the zoom prop the mocked
// Camera last received, so a test can check the component never asks for more than the device
// offers.
let mockDeviceMaxZoom = 8;
let mockLastZoomProp: number | undefined;
// The real CameraSession calls onStarted once it is running, and rejects everything sent
// before that. The mock does the same, so the props the component sets early are visible to
// a test; turning it off models a session that has not started yet.
let mockAutoStart = true;
// The session callbacks the mocked Camera was handed, so a test can drive the lifecycle the
// way CameraX does: fail, fail again, then start.
let mockCameraProps: { onStarted?: () => void; onError?: (e: Error) => void } = {};

jest.mock('react-native-vision-camera', () => {
  const { View } = jest.requireActual('react-native');
  const { forwardRef, useEffect } = jest.requireActual('react');
  return {
    Camera: forwardRef(
      (
        props: { zoom?: number; onStarted?: () => void; onError?: (e: Error) => void },
        _ref: unknown,
      ) => {
        mockLastZoomProp = props.zoom;
        mockCameraProps = props;
        useEffect(() => {
          if (mockAutoStart) {
            props.onStarted?.();
          }
          // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []);
        return <View testID="native-camera" />;
      },
    ),
    useCameraDevice: () => ({ id: 'back', maxZoom: mockDeviceMaxZoom }),
    useCameraPermission: () => ({ hasPermission: true, requestPermission: jest.fn() }),
    // The Camera runs with orientationSource="custom", so the component sets the photo output's
    // orientation itself and needs both of these.
    useOrientation: () => 'up',
    usePhotoOutput: () => ({
      outputOrientation: 'up',
      capturePhoto: async () => ({
        // The photo the sensor produced while the phone was held upright in portrait.
        orientation: 'left',
        saveToTemporaryFileAsync: async () => '/tmp/captured.jpg',
        dispose: jest.fn(),
      }),
    }),
  };
});

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
}));

const capture = async () => {
  await userEvent.press(screen.getByRole('button', { name: 'Foto aufnehmen' }));
};

describe('LiveScannerCamera capture', () => {
  beforeEach(() => {
    mockDetectAndCrop.mockClear();
    mockUprightPhoto.mockClear();
    mockDeviceMaxZoom = 8;
    mockLastZoomProp = undefined;
    mockAutoStart = true;
    mockCameraProps = {};
  });

  // CameraX reopens a failed session about twice a second and every attempt lands in onError.
  // A camera blocked by device policy produced 24 identical stack traces in 13 seconds on the
  // OnePlus 8, which buries anything else in the log. The retry cadence is CameraX's, so the
  // only part that is ours is not repeating ourselves.
  it('logs a repeated camera error only once', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockAutoStart = false;
    await render(<LiveScannerCamera mode="live" onCapture={jest.fn()} />);

    await act(async () => {
      mockCameraProps.onError?.(new Error('Camera is disabled, probably due to a device policy!'));
      mockCameraProps.onError?.(new Error('Camera is disabled, probably due to a device policy!'));
      mockCameraProps.onError?.(new Error('Camera is disabled, probably due to a device policy!'));
    });

    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  // Suppressing repeats must not silence the error for good: once a session has run, the same
  // failure is news again.
  it('reports the same error again after a session has started in between', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockAutoStart = false;
    await render(<LiveScannerCamera mode="live" onCapture={jest.fn()} />);

    await act(async () => {
      mockCameraProps.onError?.(new Error('Camera is not active.'));
      mockCameraProps.onError?.(new Error('Camera is not active.'));
      mockCameraProps.onStarted?.();
      mockCameraProps.onError?.(new Error('Camera is not active.'));
    });

    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  // CameraX rejects setZoomRatio before the session runs, with an
  // OperationCanceledException that surfaced as a vision-camera error on every cold start.
  // The value sent was 1, the neutral zoom, so the call was pure noise and the error with it.
  it('sets no zoom before the camera session has started', async () => {
    mockAutoStart = false;

    await render(<LiveScannerCamera mode="live" onCapture={jest.fn()} />);

    expect(mockLastZoomProp).toBeUndefined();
  });

  it('sets zoom once the camera session has started', async () => {
    await render(<LiveScannerCamera mode="live" onCapture={jest.fn()} />);

    expect(mockLastZoomProp).toBe(1);
  });

  it('uprights the photo before handing it on in photo mode', async () => {
    const onCapture = jest.fn();
    await render(<LiveScannerCamera mode="photo" onCapture={onCapture} />);

    await capture();

    expect(mockUprightPhoto).toHaveBeenCalledWith('file:///tmp/captured.jpg', 'left');
    expect(onCapture).toHaveBeenCalledWith('file:///tmp/upright.jpg');
  });

  it('does not crop to the placard in photo mode', async () => {
    await render(<LiveScannerCamera mode="photo" onCapture={jest.fn()} />);

    await capture();

    expect(mockDetectAndCrop).not.toHaveBeenCalled();
  });

  // Zoom is real sensor zoom now, applied to preview and inference alike, so it is offered in
  // both modes. Live keeps a lower ceiling: past roughly 2x the placard grows beyond the scale
  // the detector was trained on and detection quietly stops.
  it('offers zoom in live mode as well', async () => {
    await render(<LiveScannerCamera mode="live" onCapture={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Zoom vergrößern' })).toBeOnTheScreen();
  });

  it('caps live zoom lower than photo zoom', () => {
    expect(MAX_ZOOM_LIVE).toBeLessThan(MAX_ZOOM_PHOTO);
    expect(MAX_ZOOM_LIVE).toBe(2);
    expect(MAX_ZOOM_PHOTO).toBe(4);
  });

  // setZoom throws for a value the device cannot reach, and useZoomUpdater neither awaits nor
  // catches that: an unclamped ceiling would turn into a silent unhandled rejection.
  it('never asks the camera for more zoom than the device offers', async () => {
    // Overridden per test: a device that tops out below the photo ceiling.
    mockDeviceMaxZoom = 1.5;
    await render(<LiveScannerCamera mode="photo" onCapture={jest.fn()} />);
    for (let i = 0; i < 12; i++) {
      await userEvent.press(screen.getByRole('button', { name: 'Zoom vergrößern' }));
    }
    expect(mockLastZoomProp).toBeLessThanOrEqual(1.5);
  });

  it('crops to the placard in live mode, which uprights on the way', async () => {
    const onCapture = jest.fn();
    await render(<LiveScannerCamera mode="live" onCapture={onCapture} />);

    await capture();

    expect(mockDetectAndCrop).toHaveBeenCalledWith('file:///tmp/captured.jpg', 'left');
    expect(onCapture).toHaveBeenCalledWith('file:///tmp/cropped.jpg');
  });

  it('draws the detection overlay in live mode only', async () => {
    await render(<LiveScannerCamera mode="live" onCapture={jest.fn()} />);
    expect(screen.getByTestId('placard-overlay')).toBeOnTheScreen();

    await render(<LiveScannerCamera mode="photo" onCapture={jest.fn()} />);
    expect(screen.queryByTestId('placard-overlay')).not.toBeOnTheScreen();
  });
});
