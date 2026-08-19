import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Image, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/colors';
import { recognizeText, type IOCRResult } from '../../lib/scanner/ocr';
import { createDatabaseUnLookup } from '../../lib/scanner/un-lookup';
import { getDatabase } from '../../lib/database/connection';
import { getSubstanceByUnNumber } from '../../lib/database/hazmat-repository';
import { useScanModeStore } from '../../lib/stores/scan-mode-store';
import { ErrorBoundary } from '../../components/error-boundary';
import { CameraPermissionGate, CaptureOverlay, ZoomControls } from '../../components/scanner-camera-ui';

// Load the camera module lazily so react-native-vision-camera is only evaluated once the
// scanner is actually shown. If the native live stack is missing or throws, the error boundary
// catches it and the expo-camera fallback below takes over, statt den ganzen Scanner-Screen zu
// reißen.
const ScannerCamera = lazy(() =>
  import('../../components/live-scanner-camera').then((m) => ({ default: m.LiveScannerCamera })),
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  camera: {
    flex: 1,
  },
  // Photo/live mode toggle (top of camera screen)
  modeToggle: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  modeToggleInner: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderRadius: 20,
    padding: 4,
  },
  modeSegment: {
    paddingHorizontal: 22,
    paddingVertical: 8,
    borderRadius: 16,
  },
  modeSegmentActive: {
    backgroundColor: COLORS.primary,
  },
  modeSegmentText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Loading / fallback placeholder
  centeredContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  // Photo preview
  previewImage: {
    flex: 1,
  },
  previewActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: COLORS.surface,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  discardButton: {
    backgroundColor: COLORS.surfaceLight,
  },
  analyzeButton: {
    backgroundColor: COLORS.primary,
  },
  actionText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  analyzingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(18, 18, 18, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ocrResultCard: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.surfaceLight,
  },
  ocrResultTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  ocrConfidence: {
    fontSize: 13,
    marginTop: 4,
  },
  ocrNotFound: {
    color: COLORS.warning,
    fontSize: 14,
    textAlign: 'center',
  },
  resultScroll: {
    flex: 1,
  },
  resultScrollContent: {
    padding: 16,
    paddingBottom: 8,
  },
  ericardButton: {
    marginHorizontal: 0,
    marginTop: 8,
  },
  analyzingText: {
    color: COLORS.text,
    marginTop: 12,
    fontSize: 16,
  },
});

export default function ScannerScreen() {
  const mode = useScanModeStore((s) => s.mode);
  const setMode = useScanModeStore((s) => s.setMode);
  // Set once the vision-camera module fails to load or throws. Only then does the expo-camera
  // fallback appear, and only then is a mode toggle pointless, because live detection is
  // unavailable on that path.
  const [cameraStackFailed, setCameraStackFailed] = useState(false);
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [photo, setPhoto] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [ocrResult, setOcrResult] = useState<IOCRResult | null>(null);
  const [zoom, setZoom] = useState(0);
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();

  const takePhoto = async () => {
    if (!cameraRef.current) return;
    const result = await cameraRef.current.takePictureAsync({
      quality: 0.8,
    });
    if (result?.uri) {
      setPhoto(result.uri);
    }
  };

  const analyzePhoto = useCallback(async () => {
    if (!photo) return;
    setIsAnalyzing(true);
    try {
      // One lookup per scan: it remembers what it already asked the database, and a
      // data update between scans takes effect because the next scan builds a new one.
      const db = getDatabase();
      const result = await recognizeText(photo, createDatabaseUnLookup(db));
      setOcrResult(result);

      // In production: auto-navigate to ERICard if UN number found
      if (!__DEV__ && result.unNumber && result.confidence >= 0.6) {
        const substance = getSubstanceByUnNumber(db, result.unNumber);
        if (substance) {
          // Pass the Kemler number along: it resolves which variant is on the placard.
          router.push({
            pathname: '/substance/[unNumber]',
            params: { unNumber: result.unNumber, kemler: result.kemlerNumber ?? '' },
          });
          setPhoto(null);
          setOcrResult(null);
          return;
        }
      }
    } catch (err) {
      console.warn('[scanner] OCR failed:', err);
    } finally {
      setIsAnalyzing(false);
    }
  }, [photo, router]);

  // Live mode has already found the placard and cropped to it, so asking for a second tap
  // decides nothing. Photo mode keeps the button: it is the fallback for when detection failed,
  // and there the picture is worth a look before it goes to OCR.
  //
  // Keyed on the capture rather than on the render, otherwise the analysis would run again for
  // as long as the result is on screen.
  const analysed = useRef<string | null>(null);
  useEffect(() => {
    if (photo != null && mode === 'live' && analysed.current !== photo) {
      analysed.current = photo;
      void analyzePhoto();
    }
  }, [photo, mode, analyzePhoto]);

  const resetScanner = () => {
    setPhoto(null);
    setOcrResult(null);
  };

  // Result view (preview plus OCR), rendered as an overlay on top of the camera and not via an
  // early return: that would unmount the camera, and it only ever comes back frozen because the
  // second binding evicts its CameraX use-cases. It is deactivated instead, see `paused`.
  const renderResult = () => {
    if (photo == null) {
      return null;
    }
    return (
    <View style={styles.container}>
        {!ocrResult || isAnalyzing ? (
          <Image source={{ uri: photo }} style={styles.previewImage} resizeMode="contain" />
        ) : (
          <ScrollView style={styles.resultScroll} contentContainerStyle={styles.resultScrollContent}>
            {/* OCR result card */}
            <View style={styles.ocrResultCard}>
              {ocrResult.unNumber ? (
                <>
                  <Text style={styles.ocrResultTitle}>
                    UN {ocrResult.unNumber}
                    {ocrResult.kemlerNumber ? ` | Kemler ${ocrResult.kemlerNumber}` : ''}
                  </Text>
                  <Text style={[styles.ocrConfidence, { color: ocrResult.confidence >= 0.6 ? COLORS.success : COLORS.warning }]}>
                    Konfidenz: {Math.round(ocrResult.confidence * 100)}%
                    {ocrResult.confidence < 0.6 ? ' - bitte prüfen' : ''}
                  </Text>
                </>
              ) : (
                <Text style={styles.ocrNotFound}>
                  Keine UN-Nummer erkannt. Bitte manuell eingeben oder erneut scannen.
                </Text>
              )}
            </View>

            {/* ERICard button */}
            {ocrResult.unNumber && (
              <Pressable
                style={[styles.actionButton, styles.analyzeButton, styles.ericardButton]}
                onPress={() => {
                  router.push({
                    pathname: '/substance/[unNumber]',
                    params: { unNumber: ocrResult.unNumber, kemler: ocrResult.kemlerNumber ?? '' },
                  });
                  resetScanner();
                }}
                accessibilityRole="button"
                accessibilityLabel="ERICard ansehen"
              >
                <Text style={styles.actionText}>ERICard ansehen</Text>
              </Pressable>
            )}
          </ScrollView>
        )}

        {isAnalyzing && (
          <View style={styles.analyzingOverlay}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.analyzingText}>Text wird erkannt...</Text>
          </View>
        )}

        <View style={styles.previewActions}>
          <Pressable
            style={[styles.actionButton, styles.discardButton]}
            onPress={resetScanner}
            accessibilityRole="button"
            accessibilityLabel="Foto verwerfen"
          >
            <Text style={styles.actionText}>Verwerfen</Text>
          </Pressable>
          {!ocrResult && !isAnalyzing && (
            <Pressable
              style={[styles.actionButton, styles.analyzeButton]}
              onPress={analyzePhoto}
              accessibilityRole="button"
              accessibilityLabel="Foto analysieren"
            >
              <Text style={styles.actionText}>Analysieren</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  // Fallback camera (expo-camera) for when the vision-camera module cannot be loaded at all.
  // It is never shown alongside the scanner camera: two stacks binding use-cases to the same
  // CameraX provider evict each other, which leaves whichever came first open but silent.
  // A function so the element tree is only built once that fallback is actually needed.
  const renderFallbackCamera = () => {
    if (!permission) {
      return <View style={styles.centeredContainer} />;
    }
    if (!permission.granted) {
      return (
        <CameraPermissionGate
          text="Der Scanner benötigt Zugriff auf die Kamera um Warntafeln und Gefahrzettel zu erkennen."
          onRequest={requestPermission}
        />
      );
    }
    return (
      <>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
          zoom={zoom}
          onMountError={(error) => console.warn('[scanner] Camera mount error:', error)}
        />
        <ZoomControls value={zoom} onChange={setZoom} />
        <CaptureOverlay hint="Warntafel oder Gefahrzettel anvisieren" onCapture={takePhoto} />
      </>
    );
  };

  // Camera screen with photo/live mode toggle
  return (
    <View style={styles.container}>
      {/* One camera for both modes, mounted for as long as the screen lives. Unmounting it on
          the mode switch puts a second camera stack in its place, which evicts the first one's
          CameraX use-cases; vision-camera resumes its lifecycle afterwards but never re-binds,
          so the preview comes back open, silent and frozen for good. The mode only tells the
          camera whether to detect, and `paused` deactivates it while the result overlay is up.
          (Until the preview became native, unmounting also tore a Skia view out of the RNSkia
          registry mid-update and died with SIGSEGV. That reason is gone; this one is not.) */}
      {cameraStackFailed ? (
        renderFallbackCamera()
      ) : (
        <ErrorBoundary
          onError={(error) => {
            // Without this the fallback is silent, and a broken camera stack looks like a
            // missing feature instead of an error.
            console.warn('[scanner] camera stack failed to load:', error);
            setCameraStackFailed(true);
          }}
          fallback={<View style={styles.centeredContainer} />}
        >
          <Suspense fallback={<View style={styles.centeredContainer} />}>
            <ScannerCamera
              onCapture={setPhoto}
              mode={mode}
              paused={photo != null}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {/* Ergebnis-Overlay: liegt UEBER der (gemounteten, deaktivierten) Kamera. */}
      {photo != null && <View style={StyleSheet.absoluteFill}>{renderResult()}</View>}

      {/* No toggle on the fallback path: that camera cannot detect, so live mode has nothing
          to offer there. */}
      {photo == null && !cameraStackFailed && (
        <View style={[styles.modeToggle, { top: insets.top + 8 }]} pointerEvents="box-none">
          <View style={styles.modeToggleInner}>
            <Pressable
              style={[styles.modeSegment, mode === 'live' && styles.modeSegmentActive]}
              onPress={() => setMode('live')}
              accessibilityRole="button"
              accessibilityLabel="Live-Modus"
            >
              <Text style={[styles.modeSegmentText, { color: mode === 'live' ? COLORS.text : COLORS.textSecondary }]}>
                Live
              </Text>
            </Pressable>
            <Pressable
              style={[styles.modeSegment, mode === 'photo' && styles.modeSegmentActive]}
              onPress={() => setMode('photo')}
              accessibilityRole="button"
              accessibilityLabel="Foto-Modus"
            >
              <Text style={[styles.modeSegmentText, { color: mode === 'photo' ? COLORS.text : COLORS.textSecondary }]}>
                Foto
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}
