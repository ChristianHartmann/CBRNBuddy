import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  NativeSyntheticEvent,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import {
  Map,
  Camera,
  GeoJSONSource,
  Layer,
  Marker,
} from '@maplibre/maplibre-react-native';
import { COLORS } from '../../constants/colors';
import { circlePolygon } from '../../lib/calculations/geo';

// [longitude, latitude] - MapLibre coordinate order.
type LngLat = [number, number];

// Fallback center until GPS resolves (geographic center of Germany).
const DEFAULT_CENTER: LngLat = [10.4515, 51.1657];

// Online OSM raster tiles. Interim only - offline tiles are a separate ticket
// (CBRN-80). Passed as a JSON string so MapLibre renders it as an inline style.
const OSM_STYLE = JSON.stringify({
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap-Mitwirkende',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
});

// Rough zoom so a circle of `radiusMeters` fits comfortably on screen.
const fitZoom = (radiusMeters: number, latitude: number): number => {
  const metersPerPixel = (radiusMeters * 2.6) / 320; // ~circle diameter across width
  const zoom = Math.log2((156543.03 * Math.cos((latitude * Math.PI) / 180)) / metersPerPixel);
  return Math.min(Math.max(zoom, 9), 16);
};

// Step for manual radius adjustment - matches the ERG rounding granularity.
const RADIUS_STEP = 25;
const MIN_RADIUS = 25;

export default function EvacuationMapScreen() {
  const params = useLocalSearchParams<{ radius?: string; unNumber?: string }>();
  const calculatedRadius = Math.max(parseInt(params.radius ?? '0', 10) || 0, MIN_RADIUS);

  // Live radius shown on the map - starts at the calculated value, manually adjustable.
  const [radiusMeters, setRadiusMeters] = useState(calculatedRadius);
  const isAdjusted = radiusMeters !== calculatedRadius;

  const [permission, requestPermission] = Location.useForegroundPermissions();
  const [center, setCenter] = useState<LngLat | null>(null);
  const [address, setAddress] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const locateMe = async () => {
    setIsLocating(true);
    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCenter([pos.coords.longitude, pos.coords.latitude]);
    } catch {
      // Keep current/fallback center if GPS is unavailable.
    } finally {
      setIsLocating(false);
    }
  };

  // Center on the current position once permission is granted.
  useEffect(() => {
    if (permission?.granted && !center) {
      void locateMe();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permission?.granted]);

  const searchAddress = async () => {
    if (!address.trim()) return;
    setIsSearching(true);
    setNotFound(false);
    try {
      const results = await Location.geocodeAsync(address.trim());
      if (results.length > 0) {
        setCenter([results[0].longitude, results[0].latitude]);
      } else {
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    } finally {
      setIsSearching(false);
    }
  };

  const handleMapPress = (event: NativeSyntheticEvent<{ lngLat: LngLat }>) => {
    setCenter(event.nativeEvent.lngLat);
  };

  // Permission still loading
  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // Permission denied - offer to request, but allow address-only use below
  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.infoTitle}>Standort-Zugriff</Text>
        <Text style={styles.infoText}>
          Für die automatische Zentrierung auf deinen Standort wird Standort-Zugriff
          benötigt. Du kannst alternativ eine Adresse eingeben.
        </Text>
        <Pressable
          style={styles.permissionButton}
          onPress={requestPermission}
          accessibilityRole="button"
          accessibilityLabel="Standort-Zugriff erlauben"
        >
          <Text style={styles.permissionButtonText}>Standort erlauben</Text>
        </Pressable>
        <Pressable
          style={[styles.permissionButton, styles.secondaryButton]}
          onPress={() => setCenter(DEFAULT_CENTER)}
          accessibilityRole="button"
          accessibilityLabel="Ohne Standort fortfahren"
        >
          <Text style={styles.permissionButtonText}>Adresse eingeben</Text>
        </Pressable>
      </View>
    );
  }

  const activeCenter = center ?? DEFAULT_CENTER;
  const ring = circlePolygon(
    { longitude: activeCenter[0], latitude: activeCenter[1] },
    radiusMeters,
  );

  return (
    <View style={styles.container}>
      <Map style={styles.map} mapStyle={OSM_STYLE} onPress={handleMapPress}>
        <Camera
          center={activeCenter}
          zoom={fitZoom(calculatedRadius, activeCenter[1])}
          duration={300}
        />
        <GeoJSONSource id="ring" data={ring}>
          <Layer
            id="ringFill"
            type="fill"
            paint={{ 'fill-color': COLORS.primary, 'fill-opacity': 0.2 }}
          />
          <Layer
            id="ringLine"
            type="line"
            paint={{ 'line-color': COLORS.primary, 'line-width': 2 }}
          />
        </GeoJSONSource>
        <Marker lngLat={activeCenter}>
          <View style={styles.markerDot} />
        </Marker>
      </Map>

      {/* Address search bar */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          value={address}
          onChangeText={setAddress}
          placeholder="Adresse suchen…"
          placeholderTextColor={COLORS.textSecondary}
          onSubmitEditing={searchAddress}
          returnKeyType="search"
          accessibilityLabel="Adresse suchen"
        />
        <Pressable
          style={styles.searchButton}
          onPress={searchAddress}
          accessibilityRole="button"
          accessibilityLabel="Adresse suchen"
        >
          {isSearching ? (
            <ActivityIndicator size="small" color={COLORS.text} />
          ) : (
            <Text style={styles.searchButtonText}>Suchen</Text>
          )}
        </Pressable>
      </View>
      {notFound && <Text style={styles.notFound}>Adresse nicht gefunden.</Text>}

      {/* Locate-me button */}
      <Pressable
        style={styles.locateButton}
        onPress={locateMe}
        accessibilityRole="button"
        accessibilityLabel="Auf meinen Standort zentrieren"
      >
        {isLocating ? (
          <ActivityIndicator size="small" color={COLORS.text} />
        ) : (
          <Text style={styles.locateButtonText}>Mein Standort</Text>
        )}
      </Pressable>

      {/* Footer: radius + adjustment controls + disclaimer */}
      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <Text style={styles.footerLabel}>
            {isAdjusted ? 'Absperrradius (angepasst)' : 'Sofort-Absperrradius'}
          </Text>
          <Text style={styles.footerValue}>{radiusMeters} m</Text>
        </View>

        <View style={styles.adjustRow}>
          <Pressable
            style={styles.stepButton}
            onPress={() => setRadiusMeters((r) => Math.max(MIN_RADIUS, r - RADIUS_STEP))}
            accessibilityRole="button"
            accessibilityLabel={`Radius um ${RADIUS_STEP} Meter verkleinern`}
          >
            <Text style={styles.stepButtonText}>−{RADIUS_STEP} m</Text>
          </Pressable>

          <Pressable
            style={[styles.resetButton, !isAdjusted && styles.resetButtonDisabled]}
            onPress={() => setRadiusMeters(calculatedRadius)}
            disabled={!isAdjusted}
            accessibilityRole="button"
            accessibilityLabel="Auf berechneten Radius zurücksetzen"
          >
            <Text style={[styles.resetButtonText, !isAdjusted && styles.resetButtonTextDisabled]}>
              Zurücksetzen ({calculatedRadius} m)
            </Text>
          </Pressable>

          <Pressable
            style={styles.stepButton}
            onPress={() => setRadiusMeters((r) => r + RADIUS_STEP)}
            accessibilityRole="button"
            accessibilityLabel={`Radius um ${RADIUS_STEP} Meter vergrößern`}
          >
            <Text style={styles.stepButtonText}>+{RADIUS_STEP} m</Text>
          </Pressable>
        </View>

        <Text style={styles.footerHint}>
          Tippe auf die Karte, um den Mittelpunkt zu verschieben. Empfehlung - die
          Entscheidung liegt beim Einsatzleiter.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  map: { flex: 1 },
  centered: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  infoTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  infoText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  permissionButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: 8,
  },
  secondaryButton: { backgroundColor: COLORS.surfaceLight },
  permissionButtonText: { color: COLORS.text, fontSize: 16, fontWeight: 'bold' },
  searchBar: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.surfaceLight,
  },
  searchButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 8,
  },
  searchButtonText: { color: COLORS.text, fontWeight: 'bold' },
  notFound: {
    position: 'absolute',
    top: 56,
    left: 12,
    color: COLORS.warning,
    fontSize: 12,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  locateButton: {
    position: 'absolute',
    right: 12,
    bottom: 96,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.surfaceLight,
  },
  locateButtonText: { color: COLORS.text, fontWeight: 'bold', fontSize: 13 },
  markerDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.primary,
    borderWidth: 3,
    borderColor: COLORS.text,
  },
  footer: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  footerLabel: { color: COLORS.textSecondary, fontSize: 14 },
  footerValue: { color: COLORS.text, fontSize: 18, fontWeight: 'bold' },
  adjustRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
    marginVertical: 8,
  },
  stepButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
  },
  stepButtonText: { color: COLORS.text, fontSize: 16, fontWeight: 'bold' },
  resetButton: {
    flex: 1,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButtonDisabled: { opacity: 0.4 },
  resetButtonText: { color: COLORS.text, fontSize: 14, fontWeight: 'bold' },
  resetButtonTextDisabled: { color: COLORS.textSecondary },
  footerHint: { color: COLORS.textSecondary, fontSize: 11, fontStyle: 'italic' },
});
