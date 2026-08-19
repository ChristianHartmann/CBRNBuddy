import { render, screen, userEvent } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useScanModeStore } from '../../../lib/stores/scan-mode-store';
import ScannerScreen from '../index';

// Live mode has already found the placard and cropped to it by the time the capture arrives, so
// making the user press "Analysieren" afterwards is a tap that decides nothing. Photo mode is
// the fallback for when detection failed, where the picture is worth looking at first, so the
// button stays there.

const mockRecognizeText = jest.fn(async () => ({
  unNumber: '1203',
  kemlerNumber: '33',
  confidence: 0.9,
  rawText: '33 1203',
}));

jest.mock('../../../lib/scanner/ocr', () => ({
  recognizeText: (...args: unknown[]) => mockRecognizeText(...(args as [])),
}));

jest.mock('../../../lib/scanner/un-lookup', () => ({
  createDatabaseUnLookup: () => async () => true,
}));

jest.mock('../../../lib/database/hazmat-repository', () => ({
  getSubstanceByUnNumber: () => null,
}));

jest.mock('../../../lib/database/connection', () => ({
  getDatabase: () => ({}),
}));

// Stands in for the camera and offers the one thing this suite needs: a way to hand a capture
// to the screen the way the real camera does.
jest.mock('../../../components/live-scanner-camera', () => {
  const { Pressable, Text } = jest.requireActual('react-native');
  return {
    LiveScannerCamera: ({ onCapture }: { onCapture: (uri: string) => void }) => (
      <Pressable accessibilityRole="button" onPress={() => onCapture('file:///captured.jpg')}>
        <Text>capture</Text>
      </Pressable>
    ),
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

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

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

const capture = async () => {
  await userEvent.press(await screen.findByText('capture'));
};

describe('ScannerScreen automatic analysis', () => {
  beforeEach(() => {
    mockRecognizeText.mockClear();
    useScanModeStore.setState({ mode: 'live' });
  });

  it('analyses a live capture without asking', async () => {
    await renderScanner();

    await capture();

    expect(mockRecognizeText).toHaveBeenCalledWith('file:///captured.jpg', expect.any(Function));
    expect(screen.queryByRole('button', { name: 'Foto analysieren' })).not.toBeOnTheScreen();
  });

  it('leaves a photo capture to the user', async () => {
    useScanModeStore.setState({ mode: 'photo' });
    await renderScanner();

    await capture();

    expect(mockRecognizeText).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Foto analysieren' })).toBeOnTheScreen();
  });

  // The effect must key on the capture, not on the render: an analysis that repeats on every
  // render would hammer OCR and the database for as long as the result is on screen.
  it('analyses each capture once', async () => {
    await renderScanner();

    await capture();

    expect(mockRecognizeText).toHaveBeenCalledTimes(1);
  });
});
