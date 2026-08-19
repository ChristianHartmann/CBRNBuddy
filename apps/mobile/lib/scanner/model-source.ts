import { useEffect, useState } from 'react';
import { Asset } from 'expo-asset';
import { loadTensorflowModel, type TensorflowModel } from 'react-native-fast-tflite';

import modelMeta from '../../assets/models/placard_detector.json';

// Model asset. Only ever used to ask expo-asset for the unpacked file, never handed to
// fast-tflite directly: fast-tflite passes the module through to java.net.URL, which in a
// release build answers 'no protocol: assets_models_placard_detector'. In dev that same
// module happens to resolve over Metro HTTP, which is why the failure only showed on a real
// build. The file:// path expo-asset returns works in both.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro resolves asset modules only via require()
export const MODEL_MODULE = require('../../assets/models/placard_detector.tflite');

/** Square model input edge, 640. */
export const MODEL_SIZE = modelMeta.imgsz;

/** Confidence threshold the model was calibrated for. */
export const MODEL_CONFIDENCE = modelMeta.recommended_conf;

/**
 * The placard model, or null while it is still loading.
 *
 * Every caller gets its OWN interpreter. The photo path and the live frame worklet call
 * runSync independently, and a single interpreter shared between them would need pausing or
 * timing workarounds to stay out of its own way.
 *
 * Nothing is loaded before expo-asset has produced the file:// path, so a release build no
 * longer starts with a model load that cannot succeed.
 */
export const usePlacardModel = (): TensorflowModel | null => {
  const [model, setModel] = useState<TensorflowModel | null>(null);

  useEffect(() => {
    let active = true;
    Asset.fromModule(MODEL_MODULE)
      .downloadAsync()
      .then((asset) => loadTensorflowModel({ url: asset.localUri ?? asset.uri }, []))
      .then((loaded) => {
        if (active) {
          setModel(loaded);
        }
      })
      .catch((e) => console.warn('[scanner] placard model load failed:', String(e)));
    return () => {
      active = false;
    };
  }, []);

  return model;
};
