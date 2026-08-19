import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useResizer } from 'react-native-vision-camera-resizer';
import {
  useOrientation,
  useFrameOutput,
  type CameraFrameOutput,
  type CameraOrientation,
  type CameraRef,
  type Frame,
} from 'react-native-vision-camera';
import { scheduleOnRN } from 'react-native-worklets';

import {
  parseDetections6,
  mapToOriginal,
  boxToFrameCorners,
  orientationToDegrees,
  cancelOrientation,
  rotateRgbSquare,
  rotateBoxNorm,
} from './detector';
import {
  EMPTY_DEFLICKER,
  resolveViewBoxes,
  visibleBoxes,
  type IDeflickerState,
  type ISensorBox,
  type IViewBox,
} from './publish-boxes';
import { MODEL_CONFIDENCE as CONF, MODEL_SIZE, usePlacardModel } from './model-source';
import { MAX_LIVE_BOXES } from '../../components/placard-overlay';

// CBRN-72 (stages 2 and 3): live placard detection inside the vision-camera v5 frame output
// worklet.
//
// Frame to tensor is handled by the v5-native, GPU accelerated
// react-native-vision-camera-resizer, NOT the older vision-camera-resize-plugin built
// against v4. resizer.resize(frame) yields the model input directly (NHWC interleaved, RGB,
// float32). Then fast-tflite runSync, then parseDetections6 (output [1,300,6] has NMS built
// in), then the boxes leave the worklet.
//
// The resizer must never be asked to rotate. Its shader fits the frame into the model square
// BEFORE applying the rotation, so at 90 or 270 degrees it fits the wrong aspect ratio
// (react-native-vision-camera#4080). Measured with a landscape 1280x720 frame: instead of the
// centred 720x720 square the model got a 1280x405 strip stretched 3.2x horizontally, and
// confidence on a placard fell from 0.94 to below 0.4. The way out is to give the output the
// orientation that cancels the sensor's own mounting, so frames arrive 'up' and the shader
// rotates by 0; the model input is then turned upright here, where the geometry is ours. The
// bug is fixed in newer resizer versions, but this way does not depend on that.
//
// Boxes to screen, WYSIWYG through CameraX rather than through Skia: the worklet converts
// each box to camera SENSOR coordinates (frame.convertFramePointToCameraPoint), JS converts
// sensor to view (cameraRef.convertCameraPointToViewPoint). Both transforms are CameraX's own,
// so preview crop, rotation and zoom are accounted for without any device constant. The earlier Skia canvas that drew the frame
// itself leaked about 1 MB per preview frame and deadlocked with every Skia version that
// actually freed the image; see internal_docs/research-live-preview-alternatives.md.

// The rotation target lives on the frame output's own worklet runtime, not in a closure:
// captured values are copied into the worklet, and the serialiser handles neither TypedArrays
// nor ArrayBuffer at all (docs/scanner-pipeline.md). globalThis is the one place on that
// runtime that outlives a single frame, so the 4.9 MB buffer is allocated once and refilled
// from then on.
interface IScratchHost {
  __placardRotationScratch?: Float32Array;
}

const rotationScratch = (length: number): Float32Array => {
  'worklet';
  const host = globalThis as unknown as IScratchHost;
  const existing = host.__placardRotationScratch;
  if (existing != null && existing.length === length) {
    return existing;
  }
  // Deliberately logged: once per session means the buffer survives between frames, which is
  // the whole point. Once per frame means it does not, and we are back to allocating.
  console.log('[detector] rotation scratch allocated:', length);
  const fresh = new Float32Array(length);
  host.__placardRotationScratch = fresh;
  return fresh;
};

export interface IPlacardDetector {
  // Second frame output with its OWN thread for live detection; must be listed in
  // <Camera outputs={[...]}>. Blocking inference there throttles itself natively through
  // dropFramesWhileBusy and leaves the native preview untouched, so it stays smooth.
  inferenceOutput: CameraFrameOutput;
  // The boxes to draw, in dp relative to the camera view. Empty while nothing is detected,
  // while the preview cannot convert yet, and in photo mode.
  viewBoxes: SharedValue<IViewBox[]>;
  isReady: boolean;
}

interface IPlacardDetectorOptions {
  // Photo mode shows the same camera without detection. The flag only gates the work inside
  // the worklet, it never changes inferenceOutput or the outputs array: those must stay
  // reference stable, see the note in live-scanner-camera.tsx.
  detectionEnabled: boolean;
  // For convertCameraPointToViewPoint. Read on JS at publish time, so it may be null early on.
  cameraRef: RefObject<CameraRef | null>;
}

export const usePlacardDetector = ({
  detectionEnabled,
  cameraRef,
}: IPlacardDetectorOptions): IPlacardDetector => {
  const model = usePlacardModel();
  const resizerState = useResizer({
    width: MODEL_SIZE,
    height: MODEL_SIZE,
    channelOrder: 'rgb',
    dataType: 'float32',
    pixelLayout: 'interleaved', // model input is NHWC [1,640,640,3]
    scaleMode: 'cover',
  });
  const resizer = resizerState.state === 'ready' ? resizerState.resizer : undefined;

  const viewBoxes = useSharedValue<IViewBox[]>([]);
  // Deflicker state lives on JS only; the overlay reads viewBoxes, nothing else.
  const deflicker = useRef<IDeflickerState>(EMPTY_DEFLICKER);

  // Reaches the worklet as a SharedValue for the same reason as uprightDeg below: putting it
  // in the worklet deps would recreate the worklet and make useFrameOutput reinstall the frame
  // processor on the camera thread.
  const isDetecting = useSharedValue(detectionEnabled);
  useEffect(() => {
    isDetecting.value = detectionEnabled;
    if (!detectionEnabled) {
      // Photo mode must not keep an old box hanging around.
      deflicker.current = EMPTY_DEFLICKER;
      viewBoxes.value = [];
    }
  }, [detectionEnabled, isDetecting, viewBoxes]);

  // Physical device orientation to the uprighting rotation of the model input, see
  // orientationToDegrees. The live frame is interface-upright because the app is locked to
  // portrait; without this rotation YOLO sees the placard sideways on a turned phone and does
  // not detect it. In portrait uprightDeg is 0, a no-op.
  //
  // IMPORTANT: the orientation MUST reach the worklet through a SharedValue and NOT through
  // the worklet deps. Otherwise the frame worklet is recreated on every rotation and
  // useFrameOutput reinstalls it via setOnFrameCallback on the camera thread. That accumulated
  // and froze the pipeline after a few rotations. This way the worklet stays stable.
  const deviceOrientation = useOrientation('device');
  const uprightDeg = useSharedValue(0);
  useEffect(() => {
    uprightDeg.value = orientationToDegrees(deviceOrientation);
  }, [deviceOrientation, uprightDeg]);

  // How far the model input has to be turned to be upright, on top of the device rotation. It
  // is the sensor's own mounting, learned from the first frame rather than written down: while
  // the output still sits at its default 'up', a frame reports exactly that mounting. Once it
  // is known the output is set to cancel it, frames arrive 'up' and the resizer never rotates.
  const sensorDeg = useSharedValue(0);
  const sensorSettled = useSharedValue(false);
  // The output is created further down, after the worklet that needs these callbacks, so it is
  // reached through a ref rather than by ordering.
  const outputRef = useRef<CameraFrameOutput | null>(null);
  const learnSensorOrientation = useCallback(
    (orientation: CameraOrientation): void => {
      sensorDeg.value = orientationToDegrees(orientation);
      const output = outputRef.current;
      if (output != null) {
        output.outputOrientation = cancelOrientation(orientation);
      }
      sensorSettled.value = true;
    },
    [sensorDeg, sensorSettled],
  );

  // JS side: sensor -> view through the camera ref, then deflicker, then publish. Any failure
  // (no ref yet, preview not laid out) yields no box, never a shifted one; the next cycle in
  // 100 to 200 ms simply tries again.
  const publishBoxes = useCallback(
    (detected: ISensorBox[]): void => {
      const camera = cameraRef.current;
      const sensorToView =
        camera == null ? null : (p: { x: number; y: number }) => camera.convertCameraPointToViewPoint(p);
      deflicker.current = resolveViewBoxes(detected, deflicker.current, sensorToView);
      viewBoxes.value = visibleBoxes(deflicker.current);
    },
    [cameraRef, viewBoxes],
  );

  // Live detection on its OWN frame output and thread. In the vision-camera v5 architecture
  // every output has its own worklet thread, so the blocking inference (runSync) only slows
  // this output down. Meanwhile dropFramesWhileBusy, the default, discards new frames
  // natively and the preview keeps running unaffected.
  // Failed alternatives, all falsified on the device, do NOT try them again: useAsyncRunner
  // (throws, open library TODO), large buffers via scheduleOnRN (the serialiser cannot handle
  // TypedArrays or ArrayBuffer), and model.run() inside the worklet (a Nitro promise without a
  // dispatcher, which aborts with SIGABRT).
  const onInferenceFrame = useCallback(
    (frame: Frame): void => {
      'worklet';
      try {
        if (!isDetecting.value || model == null || resizer == null) {
          return;
        }
        if (!sensorSettled.value) {
          // First frames: the output still sits at 'up', so the frame reports the sensor's own
          // mounting. Learn it, then let JS cancel it. Until it is applied the frame is rotated
          // and the resizer would fit the wrong aspect ratio, so nothing is detected yet.
          if (frame.orientation !== 'up') {
            scheduleOnRN(learnSensorOrientation, frame.orientation);
            return;
          }
          sensorSettled.value = true;
        }
        const deg = (sensorDeg.value + uprightDeg.value) % 360;
        const resized = resizer.resize(frame);
        try {
          // Upright the model input so YOLO sees the placard the way it was trained. The
          // deg === 0 branch does not fire in practice - the frame arrives as the sensor
          // delivers it, so deg carries at least the sensor's own mounting - but it is the
          // cheaper path when it does, because the GPU buffer goes to the model untouched.
          const buf = resized.getPixelBuffer();
          let input: ArrayBuffer;
          if (deg === 0) {
            input = buf;
          } else {
            const scratch = rotationScratch(MODEL_SIZE * MODEL_SIZE * 3);
            rotateRgbSquare(new Float32Array(buf), scratch, MODEL_SIZE, deg);
            input = scratch.buffer as ArrayBuffer;
          }
          const outputs = model.runSync([input]);
          const raw = new Float32Array(outputs[0]);
          const shape = model.outputs[0].shape;
          const dets = parseDetections6(raw, shape, null, CONF);
          dets.sort((a, b) => b.confidence - a.confidence);
          const boxes: ISensorBox[] = [];
          for (let i = 0; i < dets.length && i < MAX_LIVE_BOXES; i++) {
            // Undo the device rotation, undo the resizer's cover cut into frame pixels, then let
            // CameraX take the corners to sensor coordinates.
            const box = rotateBoxNorm(mapToOriginal(dets[i], 1, 1, 1), deg);
            const c = boxToFrameCorners(box, frame.width, frame.height);
            const a = frame.convertFramePointToCameraPoint({ x: c.x1, y: c.y1 });
            const b = frame.convertFramePointToCameraPoint({ x: c.x2, y: c.y2 });
            boxes.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, confidence: dets[i].confidence });
          }
          // Publish the result, which is small, to JS. Small objects are fine for the worklet
          // serialiser.
          scheduleOnRN(publishBoxes, boxes);
        } finally {
          resized.dispose();
        }
      } catch (err) {
        console.warn('[detector] live inference failed:', String(err));
      } finally {
        frame.dispose();
      }
    },
    [
      model,
      resizer,
      uprightDeg,
      publishBoxes,
      isDetecting,
      sensorDeg,
      sensorSettled,
      learnSensorOrientation,
    ],
  );
  const inferenceOutput = useFrameOutput({
    pixelFormat: 'yuv',
    // Off on purpose. With physical rotation CameraX' sensorToBufferTransformMatrix comes back
    // wrong - measured on the device, it reported negative sensor coordinates - and
    // vision-camera's own coordinate harness only ever exercises these conversions with rotation
    // off. Without it the transform reports exactly the centred band it should. The frame is
    // therefore kept as the sensor delivers it, and the model input is turned upright here.
    enablePhysicalBufferRotation: false,
    onFrame: onInferenceFrame,
  });
  outputRef.current = inferenceOutput;

  return {
    inferenceOutput,
    viewBoxes,
    isReady: model != null && resizerState.state === 'ready',
  };
};
