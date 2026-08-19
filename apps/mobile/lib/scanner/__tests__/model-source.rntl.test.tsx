import { render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { MODEL_MODULE, usePlacardModel } from '../model-source';

// expo-asset unpacks the bundled .tflite and hands back a file:// path. Only that path loads
// in a release build, and only after an await.
jest.mock('expo-asset', () => ({
  Asset: {
    fromModule: () => ({
      downloadAsync: async () => ({ localUri: 'file:///data/model.tflite', uri: 'asset:/model' }),
    }),
  },
}));

const mockLoad = jest.fn(async (_source: unknown, _delegates: unknown) => ({
  runSync: jest.fn(),
}));
jest.mock('react-native-fast-tflite', () => ({
  loadTensorflowModel: (source: unknown, delegates: unknown) => mockLoad(source, delegates),
}));

const Probe = () => <Text testID="probe">{usePlacardModel() == null ? 'loading' : 'loaded'}</Text>;

describe('usePlacardModel', () => {
  beforeEach(() => {
    mockLoad.mockClear();
  });

  // fast-tflite passes a require() module straight to java.net.URL, which answers
  // "no protocol: assets_models_placard_detector" in a release build. Loading it at all meant
  // one guaranteed failed model load on every cold start, logged as an error, for a source
  // that was never going to work. In dev it resolves over Metro HTTP, which is why this only
  // ever showed on a real build.
  it('never loads the require() module, which a release build cannot resolve', async () => {
    await render(<Probe />);

    await waitFor(() => expect(mockLoad).toHaveBeenCalled());
    for (const call of mockLoad.mock.calls) {
      expect(call[0]).not.toBe(MODEL_MODULE);
    }
  });

  it('loads exactly once, from the resolved file:// path', async () => {
    await render(<Probe />);

    await waitFor(() => expect(mockLoad).toHaveBeenCalledTimes(1));
    expect(mockLoad).toHaveBeenCalledWith({ url: 'file:///data/model.tflite' }, []);
  });
});
