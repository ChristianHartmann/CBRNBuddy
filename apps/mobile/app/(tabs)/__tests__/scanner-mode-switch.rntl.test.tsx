import { render, screen, userEvent } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useScanModeStore } from '../../../lib/stores/scan-mode-store';
import ScannerScreen from '../index';

// The failure this guards against was only ever visible on a device and never surfaced as a JS
// error: mounting expo-camera next to the scanner camera binds a second set of use-cases to the
// same CameraX provider, which evicts the first one's. vision-camera resumes its lifecycle
// afterwards but never re-binds, so the preview comes back open, silent and frozen for good.
//
// One camera, mounted across the mode switch, avoids it. A second failure used to make this
// doubly necessary - unmounting tore a Skia view out of the RNSkia registry mid-update and died
// with SIGSEGV - but the preview is native now and Skia is gone.
const mockCameraUnmounted = jest.fn();
const mockCameraProps: { mode?: string; paused?: boolean } = {};

jest.mock('../../../components/live-scanner-camera', () => {
  const { View } = jest.requireActual('react-native');
  const { useEffect } = jest.requireActual('react');
  return {
    LiveScannerCamera: ({ mode, paused }: { mode?: string; paused?: boolean }) => {
      mockCameraProps.mode = mode;
      mockCameraProps.paused = paused;
      useEffect(() => mockCameraUnmounted, []);
      return <View testID="scanner-camera" />;
    },
  };
});

jest.mock('expo-camera', () => {
  const { View } = jest.requireActual('react-native');
  return {
    CameraView: () => <View testID="fallback-camera" />,
    useCameraPermissions: () => [{ granted: true }, jest.fn()],
  };
});

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

// The scan mode store persists through AsyncStorage, whose native module is absent in tests.
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('../../../lib/database/connection', () => ({
  getDatabase: () => ({}),
}));

const SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const renderScanner = () =>
  render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <ScannerScreen />
    </SafeAreaProvider>,
  );

const switchToPhotoMode = async () => {
  await userEvent.press(screen.getByRole('button', { name: 'Foto-Modus' }));
};

describe('ScannerScreen mode switch', () => {
  beforeEach(() => {
    mockCameraUnmounted.mockClear();
    delete mockCameraProps.mode;
    delete mockCameraProps.paused;
    useScanModeStore.setState({ mode: 'live' });
  });

  it('keeps the one camera mounted when switching to photo mode', async () => {
    await renderScanner();
    expect(await screen.findByTestId('scanner-camera')).toBeOnTheScreen();

    await switchToPhotoMode();

    expect(screen.getByTestId('scanner-camera')).toBeOnTheScreen();
    expect(mockCameraUnmounted).not.toHaveBeenCalled();
  });

  it('opens no second camera in photo mode', async () => {
    await renderScanner();
    await screen.findByTestId('scanner-camera');

    await switchToPhotoMode();

    expect(screen.queryByTestId('fallback-camera')).not.toBeOnTheScreen();
  });

  // Asserted together on purpose: `paused` alone would also read false from the render before
  // the switch, so it only means anything once the mode has demonstrably arrived.
  it('hands the mode to the camera and leaves it running', async () => {
    await renderScanner();
    await screen.findByTestId('scanner-camera');
    expect(mockCameraProps).toMatchObject({ mode: 'live', paused: false });

    await switchToPhotoMode();

    expect(mockCameraProps).toMatchObject({ mode: 'photo', paused: false });
  });
});
