import { Images, type Image } from 'react-native-nitro-image';

import { parseDetections6, mapToOriginal, type IBox } from './detector';
import { MODEL_CONFIDENCE, MODEL_SIZE, usePlacardModel } from './model-source';

/**
 * Stage 4 of the scanner: YOLO on the captured photo, cropped to the placard.
 *
 * Separate from the live path on purpose. The two share only the model file and the
 * post-processing in detector.ts: this one runs on the JS thread with its own
 * interpreter, uses nitro-image rather than the frame resizer, and has no worklets in
 * it at all.
 */

/**
 * Crop pipeline tracing. Development only: this runs on every capture and would fill
 * release logs with geometry noise.
 */
const traceCrop = (message: string): void => {
  if (__DEV__) {
    console.log('[crop] ' + message);
  }
};

// Relative margin around the placard when cropping. Generous on purpose, so a slightly tight
// YOLO box does not clip the outer digits of the Kemler or UN number. Clipped digits would
// produce a wrong UN number, which is safety critical. Better a little more surroundings than
// one digit too few.
const CROP_PADDING = 0.14;

// Only from this confidence upwards is the top box used for cropping. Below it a false
// detection is too likely, so the full image goes to OCR, which then sees the whole scene,
// rather than cropping tightly to a possibly wrong region.
const CROP_MIN_CONF = 0.4;

// Orientation as reported by the v5 `Photo`, relative to the upright display.
export type TPhotoOrientation = 'up' | 'right' | 'down' | 'left';

// Uprighting rotations per reported photo orientation: best guess first, then the remaining
// 90 degree steps as fallbacks. On the Android sensor the captured photo comes out in
// landscape, but OCR and YOLO need it upright. YOLO is not rotation invariant, so only the
// upright rotation yields a detection. We therefore try them in order and stop at the first
// hit, which means the sign and convention of rotate() need not be exactly right: the correct
// rotation simply wins while trying.
const UPRIGHT_CANDIDATES: Record<TPhotoOrientation, readonly number[]> = {
  up: [0, 90, 270, 180],
  left: [90, 270, 0, 180],
  right: [270, 90, 0, 180],
  down: [180, 0, 90, 270],
};

// R/G/B byte offsets inside the four channel raw pixel from nitro-image (toRawPixelData) for
// THIS device. Verified empirically against the model: ABGR (R=3, G=2, B=1) gives a rawMax of
// 0.87. The reported pixelFormat ("BGRA") does NOT match the actual byte layout; reading it
// as BGRA gave only 0.08, turning orange into blue, and nothing was detected. iOS may use a
// different layout, so device-verified pixelFormat handling is part of the iOS bring-up.
const PHOTO_RGB_OFFSETS: readonly [number, number, number] = [3, 2, 1];

// Four channel raw pixels to the model input float32 [1,640,640,3], RGB normalised to 0..1.
// Photo path only; on the frame path the resizer does this.
const normalizeRgb = (src: Uint8Array): Float32Array => {
  const [ro, go, bo] = PHOTO_RGB_OFFSETS;
  const pixels = (src.length / 4) | 0;
  const out = new Float32Array(pixels * 3);
  for (let i = 0; i < pixels; i++) {
    const s = i * 4;
    const d = i * 3;
    out[d] = src[s + ro] / 255;
    out[d + 1] = src[s + go] / 255;
    out[d + 2] = src[s + bo] / 255;
  }
  return out;
};

const stripFilePrefix = (uri: string): string => (uri.startsWith('file://') ? uri.slice(7) : uri);

export interface IPhotoCrop {
  /**
   * Run YOLO on the captured photo and crop to the best placard, yielding a crop URI for
   * OCR. The photo is physically uprighted first, since the sensor delivers landscape.
   * On no detection or on error the unchanged full image is returned, so the caller never
   * has to handle a failure case.
   */
  detectAndCrop: (uri: string, orientation: TPhotoOrientation) => Promise<string>;
  /**
   * Upright the captured photo and nothing else, for the photo mode that deliberately runs
   * no detection. Without this the sensor's landscape picture reaches both the preview and
   * OCR lying on its side. On error the unchanged image is returned.
   */
  uprightPhoto: (uri: string, orientation: TPhotoOrientation) => Promise<string>;
}

export const usePhotoCrop = (): IPhotoCrop => {
  // Its OWN interpreter, independent of the frame worklet interpreter on the camera
  // thread. Two distinct interpreters let the photo runSync and the live runSync coexist
  // without conflict, so no pausing or timing workaround. usePlacardModel loads one per
  // caller, which is what keeps them separate.
  const photoModel = usePlacardModel();

  // Detection on an already uprighted nitro image. Returns the best normalised box (0..1) or
  // null. Model input is float32 [1,640,640,3] RGB with a stretch resize, hence linear
  // mapping.
  // IMPORTANT: nitro-image resize() is lazy. Without forcing materialisation the synchronous
  // toRawPixelData() returns an empty buffer, showing up as rawMax 0. Hence resizeAsync and
  // toRawPixelDataAsync, which wait for the GPU to CPU readback.
  const detectOnImage = async (image: Image): Promise<IBox | null> => {
    const resized = await image.resizeAsync(MODEL_SIZE, MODEL_SIZE);
    try {
      const rawPx = await resized.toRawPixelDataAsync();
      const input = normalizeRgb(new Uint8Array(rawPx.buffer));
      const outputs = photoModel!.runSync([input.buffer as ArrayBuffer]);
      const raw = new Float32Array(outputs[0]);
      const shape = photoModel!.outputs[0].shape;
      const dets = parseDetections6(raw, shape, null, MODEL_CONFIDENCE);
      let best: IBox | null = null;
      for (let i = 0; i < dets.length; i++) {
        const b = mapToOriginal(dets[i], 1, 1, 1); // normalised box (0..1)
        if (best == null || b.confidence > best.confidence) {
          best = b;
        }
      }
      return best;
    } finally {
      resized.dispose();
    }
  };

  // Save a nitro image as JPEG into a temp file, yielding a file:// URI. Quality is 0..100, not 0..1.
  const imageToTempUri = async (img: Image): Promise<string> => {
    const path = await img.saveToTemporaryFileAsync('jpg', 95);
    return path.startsWith('file://') ? path : `file://${path}`;
  };

  // Rotate a loaded photo to upright and write it out. Used both by photo mode and by every
  // detectAndCrop path that falls back to the full image, so "upright" means the same thing
  // everywhere: the first, most likely candidate for the reported orientation.
  const uprightToTempUri = async (loaded: Image, deg: number): Promise<string> => {
    const upright = deg === 0 ? loaded : await loaded.rotateAsync(deg);
    try {
      return await imageToTempUri(upright);
    } finally {
      if (upright !== loaded) {
        upright.dispose();
      }
    }
  };

  const uprightPhoto = async (uri: string, orientation: TPhotoOrientation): Promise<string> => {
    let loaded: Image | null = null;
    try {
      loaded = await Images.loadFromFileAsync(stripFilePrefix(uri));
      // No detection here, so there is nothing to try rotations against: take the most likely
      // candidate for the reported orientation, which is what UPRIGHT_CANDIDATES lists first.
      return await uprightToTempUri(loaded, UPRIGHT_CANDIDATES[orientation][0]);
    } catch (err) {
      console.warn('[crop] uprightPhoto failed:', String(err));
      return uri;
    } finally {
      loaded?.dispose();
    }
  };

  const detectAndCrop = async (uri: string, orientation: TPhotoOrientation): Promise<string> => {
    if (photoModel == null) {
      return uri;
    }
    let cropUri = uri;
    let base: Image | null = null;
    try {
      // `loaded` is the non-null reference for the loop; `base` holds it for dispose in finally.
      const loaded = await Images.loadFromFileAsync(stripFilePrefix(uri));
      base = loaded;
      // Physically upright the photo and detect: best rotation first, then the fallbacks.
      const candidates = UPRIGHT_CANDIDATES[orientation];
      let detected = false;
      for (let c = 0; c < candidates.length && !detected; c++) {
        const deg = candidates[c];
        // rotate() without allowFastFlagRotation gives physically rotated pixels; an EXIF flag
        // would be ignored by toRawPixelData. At deg===0 the original image is used as is.
        const upright = deg === 0 ? loaded : await loaded.rotateAsync(deg);
        try {
          const best = await detectOnImage(upright);
          if (best == null) {
            continue; // this rotation found nothing, try the next one
          }
          detected = true; // upright rotation found, stop trying further rotations
          if (best.confidence < CROP_MIN_CONF) {
            // Weak detection: do not crop tightly, but hand the UPRIGHTED full image to OCR
            // rather than the sideways original, so OCR sees the whole scene upright.
            cropUri = await imageToTempUri(upright);
            traceCrop(
              'orient=' + orientation + ' deg=' + deg + ' conf=' +
                best.confidence.toFixed(2) + ' < ' + CROP_MIN_CONF + ' → uprightes Vollbild',
            );
            break;
          }
          // Crop to the placard plus padding, in pixels of the uprighted image, clamped.
          const w = upright.width;
          const h = upright.height;
          const x1 = Math.max(0, Math.round((best.x - CROP_PADDING) * w));
          const y1 = Math.max(0, Math.round((best.y - CROP_PADDING) * h));
          const x2 = Math.min(w, Math.round((best.x + best.width + CROP_PADDING) * w));
          const y2 = Math.min(h, Math.round((best.y + best.height + CROP_PADDING) * h));
          if (x2 <= x1 || y2 <= y1) {
            // Degenerate box: use the uprighted full image instead of an empty crop.
            cropUri = await imageToTempUri(upright);
            traceCrop('orient=' + orientation + ' deg=' + deg + ' Box degeneriert → uprightes Vollbild');
            break;
          }
          const cropped = upright.crop(x1, y1, x2, y2);
          try {
            cropUri = await imageToTempUri(cropped);
          } finally {
            cropped.dispose();
          }
          traceCrop(
            'orient=' + orientation + ' deg=' + deg + ' conf=' + best.confidence.toFixed(2) +
            ' box=(' + best.x.toFixed(2) + ',' + best.y.toFixed(2) + ',' + best.width.toFixed(2) + ',' + best.height.toFixed(2) + ')',
          );
        } finally {
          if (upright !== loaded) {
            upright.dispose();
          }
        }
      }
      if (!detected) {
        // No placard detected, for example too close or zoomed in past the model's scale limit,
        // or simply none in the image: hand the UPRIGHTED full image to OCR, using the most
        // likely rotation, instead of the sideways original. When zoomed the placard is large
        // and clear, so OCR reads it directly.
        const deg = candidates[0];
        cropUri = await uprightToTempUri(loaded, deg);
        traceCrop('orient=' + orientation + ' keine Tafel → uprightes Vollbild (deg=' + deg + ')');
      }
    } catch (err) {
      console.warn('[crop] detectAndCrop failed:', String(err));
    } finally {
      base?.dispose();
    }
    return cropUri;
  };

  return { detectAndCrop, uprightPhoto };
};
