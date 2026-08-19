import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useOrientation,
  usePhotoOutput,
  type CameraRef,
} from 'react-native-vision-camera';
import { COLORS } from '../constants/colors';
import {
  CameraInfoScreen,
  CameraPermissionGate,
  CaptureOverlay,
  ZoomControls,
} from './scanner-camera-ui';
import { PlacardOverlay } from './placard-overlay';
import { usePlacardDetector } from '../lib/scanner/use-placard-detector';
import { usePhotoCrop } from '../lib/scanner/use-photo-crop';
import type { ScanMode } from '../lib/stores/scan-mode-store';

// The scanner's one and only camera, serving BOTH modes: vision-camera v5's native preview,
// with the detection boxes drawn over it by PlacardOverlay.
//
// WYSIWYG means "same sensor coordinate", not "same pixel": the box travels from the model
// square through frame pixels to CameraX sensor coordinates in the worklet, and from sensor
// coordinates to view dp on JS. Both transforms are CameraX's own, so preview crop, rotation
// and zoom are accounted for without device constants. The earlier Skia canvas that drew the
// camera frame itself was a dead end: about 1 MB leaked per preview frame with react-native-
// skia 2.2.12, and every version that actually freed the image deadlocked against Hermes from
// the camera thread. Details in internal_docs/research-live-preview-alternatives.md.
//
// The modes differ in what happens around the picture, never in who owns the camera:
//   live  - detection runs, boxes are drawn, the capture is cropped to the placard.
//   photo - detection is off, no boxes, the capture is handed on whole for OCR.
//
// IMPORTANT (one camera stack): photo mode must NOT open a second camera. Both this component
// and expo-camera bind their use-cases to the same CameraX ProcessCameraProvider, and the
// second binding evicts the first. vision-camera then only resumes its lifecycle when it comes
// back and never re-binds, leaving a camera that is open, silent and frozen forever. expo-camera
// is therefore only reachable as a fallback for when this whole module fails to load, at which
// point nothing here is mounted to conflict with.
//
// Zoom is real sensor zoom (<Camera zoom>), CameraX applies it to preview, inference and
// capture alike, so the model sees what the user sees. Live mode keeps a lower ceiling: past
// roughly 2x the placard grows beyond the scale the detector was trained on and detection
// quietly stops (docs/scanner-pipeline.md, scale sensitivity). Photo mode goes to 4x, beyond
// which a 4000x3000 capture no longer has the pixels for OCR to read a Kemler number.

export const MAX_ZOOM_LIVE = 2;
export const MAX_ZOOM_PHOTO = 4;

interface IScannerCameraProps {
  onCapture: (uri: string) => void;
  mode: ScanMode;
  // True while the result overlay is visible: deactivate the camera but keep it mounted.
  paused?: boolean;
}

export const LiveScannerCamera = ({
  onCapture,
  mode,
  paused = false,
}: IScannerCameraProps) => {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const photoOutput = usePhotoOutput();
  const cameraRef = useRef<CameraRef>(null);
  const isLive = mode === 'live';
  // 0..1 as the control reports it, mapped to a factor against the mode's ceiling. Kept here
  // rather than in the screen: it means nothing to anyone else, and it resets when the camera
  // goes away.
  const [zoom, setZoom] = useState(0);
  // CameraX refuses setZoomRatio while the session is not running and answers with an
  // OperationCanceledException. The zoom prop was set from the first render, so every cold
  // start logged that error - for a value of 1, which would not have changed anything anyway.
  // The session says when it is ready, so we wait for it to say so.
  const [sessionStarted, setSessionStarted] = useState(false);
  // Clamped to what the device offers: setZoom throws for values it cannot reach, and that
  // throw would be a silent unhandled rejection rather than an onError.
  const maxZoom = Math.min(isLive ? MAX_ZOOM_LIVE : MAX_ZOOM_PHOTO, device?.maxZoom ?? 1);
  const zoomFactor = 1 + zoom * (maxZoom - 1);
  // Two independent paths: the live preview draws boxes on every inference cycle, the capture
  // runs the model once on the taken photo. They share only the model file.
  const { inferenceOutput, viewBoxes, isReady } = usePlacardDetector({
    detectionEnabled: isLive,
    cameraRef,
  });
  // The Camera normally pushes one orientation onto every output. The inference output needs a
  // different one from the photo output (see usePlacardDetector), so the Camera is told to keep
  // out of it with orientationSource="custom" and both are set explicitly. This one keeps the
  // photo behaviour unchanged: captures follow the physical device orientation.
  const deviceOrientation = useOrientation('device');
  useEffect(() => {
    if (deviceOrientation != null) {
      photoOutput.outputOrientation = deviceOrientation;
    }
  }, [photoOutput, deviceOrientation]);

  const { detectAndCrop, uprightPhoto } = usePhotoCrop();
  const isFocused = useIsFocused();
  const capturing = useRef(false);

  // Camera is wrapped in React.memo, so these props MUST be reference stable. Otherwise it
  // re-renders with every parent render, including every rotation through useOrientation.
  // Hence outputs and onError are memoised; the frame worklet is already stable inside the
  // hook. inferenceOutput is the second frame output, on its own thread, for live detection.
  const outputs = useMemo(() => [photoOutput, inferenceOutput], [photoOutput, inferenceOutput]);
  // CameraX reopens a failed session roughly twice a second and every attempt arrives here.
  // A camera blocked by device policy therefore wrote 24 identical stack traces in 13 seconds
  // and buried everything else. The retry is CameraX's to make, so what is left to us is not
  // saying the same thing over and over.
  const lastError = useRef<string | null>(null);
  const handleError = useCallback((error: Error) => {
    const message = String(error);
    if (message === lastError.current) {
      return;
    }
    lastError.current = message;
    console.warn('[scanner] vision-camera error:', error);
  }, []);
  const handleStarted = useCallback(() => {
    setSessionStarted(true);
    // A session that ran resets the filter: the same failure afterwards is a new fact, not a
    // repeat, and silencing it for the rest of the process would hide a real regression.
    lastError.current = null;
  }, []);
  // Pausing or leaving the screen tears the session down, so the gate has to close again;
  // otherwise the next start would be sent a zoom before it is running.
  const handleStopped = useCallback(() => setSessionStarted(false), []);

  const capture = async (): Promise<void> => {
    if (capturing.current) {
      return;
    }
    capturing.current = true;
    let photo: Awaited<ReturnType<typeof photoOutput.capturePhoto>> | null = null;
    try {
      photo = await photoOutput.capturePhoto({}, {});
      const path = await photo.saveToTemporaryFileAsync();
      if (!path) {
        console.warn('[scanner] capturePhoto: kein Datei-Pfad');
        return;
      }
      const uri = path.startsWith('file://') ? path : `file://${path}`;
      // Photo mode is the fallback for when the detector does not find the placard, so it
      // hands on the whole picture: cropping there would throw away the very region the user
      // switched modes to capture. Uprighting is NOT optional on either path, the sensor
      // always delivers landscape; in live mode detectAndCrop does it on the way. Zoom needs
      // no handling here: the sensor already delivered the zoomed photo.
      const captured = isLive
        ? await detectAndCrop(uri, photo.orientation)
        : await uprightPhoto(uri, photo.orientation);
      // The parent shows the result overlay and sets paused, which deactivates the camera without unmounting.
      onCapture(captured);
    } catch (err) {
      console.warn('[scanner] capturePhoto failed:', err);
    } finally {
      photo?.dispose();
      capturing.current = false;
    }
  };

  if (!hasPermission) {
    return (
      <CameraPermissionGate
        text="Der Scanner benötigt Zugriff auf die Kamera um Warntafeln und Gefahrzettel zu erkennen."
        onRequest={requestPermission}
      />
    );
  }

  if (!device) {
    return (
      <CameraInfoScreen
        title="Keine Kamera gefunden"
        text="Es wurde keine Rückkamera gefunden."
      />
    );
  }

  return (
    <View style={styles.flex}>
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isFocused && !paused}
        outputs={outputs}
        zoom={sessionStarted ? zoomFactor : undefined}
        resizeMode="cover"
        orientationSource="custom"
        onStarted={handleStarted}
        onStopped={handleStopped}
        onError={handleError}
      />
      {isLive && <PlacardOverlay viewBoxes={viewBoxes} />}
      {isLive && !isReady && (
        <View style={styles.modelLoading} pointerEvents="none">
          <Text style={styles.modelLoadingText}>Modell wird geladen…</Text>
        </View>
      )}
      <ZoomControls value={zoom} onChange={setZoom} />
      <CaptureOverlay
        hint={isLive ? 'Warntafel anvisieren' : 'Warntafel oder Gefahrzettel anvisieren'}
        onCapture={capture}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: COLORS.black,
  },
  modelLoading: {
    position: 'absolute',
    top: '45%',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modelLoadingText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
});
