import { View, Text, Pressable, StyleSheet } from 'react-native';
import { COLORS } from '../constants/colors';

// Geteilte Scanner-Kamera-UI-Bausteine, genutzt von Foto-Modus (scanner.tsx, expo-camera)
// UND Live-Modus (live-scanner-camera.tsx, vision-camera). Vermeidet duplizierte Styles/JSX.

const ZOOM_STEP = 0.1; // UI-Zoom-Schritt (0..1) pro Tastendruck (CBRN-63)

interface ICameraPermissionGateProps {
  text: string;
  onRequest: () => void;
}

export const CameraPermissionGate = ({ text, onRequest }: ICameraPermissionGateProps) => (
  <View style={styles.centered}>
    <Text style={styles.infoIcon}>{'\u{1F4F7}'}</Text>
    <Text style={styles.infoTitle}>Kamera-Zugriff benötigt</Text>
    <Text style={styles.infoText}>{text}</Text>
    <Pressable
      style={styles.permissionButton}
      onPress={onRequest}
      accessibilityRole="button"
      accessibilityLabel="Kamera-Zugriff erlauben"
    >
      <Text style={styles.permissionButtonText}>Kamera erlauben</Text>
    </Pressable>
  </View>
);

interface ICameraInfoScreenProps {
  title: string;
  text: string;
}

export const CameraInfoScreen = ({ title, text }: ICameraInfoScreenProps) => (
  <View style={styles.centered}>
    <Text style={styles.infoIcon}>{'\u{1F4F7}'}</Text>
    <Text style={styles.infoTitle}>{title}</Text>
    <Text style={styles.infoText}>{text}</Text>
  </View>
);

interface IZoomControlsProps {
  value: number; // 0..1
  onChange: (next: number) => void;
}

export const ZoomControls = ({ value, onChange }: IZoomControlsProps) => (
  <View style={styles.zoomControls} pointerEvents="box-none">
    <Pressable
      style={styles.zoomButton}
      onPress={() => onChange(Math.min(1, +(value + ZOOM_STEP).toFixed(2)))}
      accessibilityRole="button"
      accessibilityLabel="Zoom vergrößern"
    >
      <Text style={styles.zoomButtonText}>+</Text>
    </Pressable>
    <Text style={styles.zoomLabel}>{Math.round(value * 100)}%</Text>
    <Pressable
      style={styles.zoomButton}
      onPress={() => onChange(Math.max(0, +(value - ZOOM_STEP).toFixed(2)))}
      accessibilityRole="button"
      accessibilityLabel="Zoom verkleinern"
    >
      <Text style={styles.zoomButtonText}>−</Text>
    </Pressable>
  </View>
);

interface ICaptureOverlayProps {
  hint: string;
  onCapture: () => void;
}

export const CaptureOverlay = ({ hint, onCapture }: ICaptureOverlayProps) => (
  <View style={styles.overlay}>
    <Text style={styles.hint}>{hint}</Text>
    <Pressable
      style={styles.captureButton}
      onPress={onCapture}
      accessibilityRole="button"
      accessibilityLabel="Foto aufnehmen"
    >
      <View style={styles.captureButtonInner} />
    </Pressable>
  </View>
);

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  infoIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  infoTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  infoText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  permissionButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 40,
    paddingTop: 20,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  hint: {
    color: COLORS.text,
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.text,
    borderWidth: 4,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButtonInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: COLORS.text,
  },
  zoomControls: {
    position: 'absolute',
    right: 16,
    top: '35%',
    alignItems: 'center',
    gap: 12,
  },
  zoomButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderWidth: 2,
    borderColor: COLORS.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomButtonText: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: 'bold',
    lineHeight: 30,
  },
  zoomLabel: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: 'bold',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
});
