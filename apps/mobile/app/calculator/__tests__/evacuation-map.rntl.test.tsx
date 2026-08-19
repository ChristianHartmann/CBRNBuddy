import { render, screen } from '@testing-library/react-native';

import EvacuationMapScreen from '../evacuation-map';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ radius: '300', unNumber: '1017' }),
}));

jest.mock('expo-location', () => ({
  useForegroundPermissions: () => [{ granted: true }, jest.fn()],
  getCurrentPositionAsync: jest.fn().mockResolvedValue({
    coords: { longitude: 8.4, latitude: 49.5 },
  }),
  geocodeAsync: jest.fn().mockResolvedValue([]),
  Accuracy: { Balanced: 3 },
}));

// The native map renders nothing useful under jest, so it is reduced to plain views. The
// screen's own chrome is what these tests are about.
jest.mock('@maplibre/maplibre-react-native', () => {
  // Rendering the children straight through keeps react-native out of this factory, which
  // jest hoists above the imports.
  const passthrough = ({ children }: { children?: React.ReactNode }) => children ?? null;
  return {
    Map: passthrough,
    Camera: () => null,
    GeoJSONSource: passthrough,
    Layer: () => null,
    Marker: passthrough,
  };
});

describe('EvacuationMapScreen', () => {
  // The OpenStreetMap tile usage policy requires the attribution to be visible. MapLibre
  // draws its own in the bottom left corner, where the radius card covers it, so the
  // screen has to carry the credit itself.
  it('credits OpenStreetMap where the card cannot cover it', async () => {
    await render(<EvacuationMapScreen />);

    expect(screen.getByText(/OpenStreetMap/)).toBeOnTheScreen();
  });

  it('offers the reset control with the calculated radius', async () => {
    await render(<EvacuationMapScreen />);

    expect(
      screen.getByRole('button', { name: 'Auf berechneten Radius zurücksetzen' })
    ).toBeOnTheScreen();
  });
});
