import '../global.css';

import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator } from 'react-native';
import { getDatabase } from '../lib/database/connection';
import { runMigrations } from '../lib/database/migrations';
import { seedDatabase } from '../lib/database/seed';
import { COLORS } from '../constants/colors';

export default function RootLayout() {
  const [isDbReady, setIsDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const db = getDatabase();
      runMigrations(db);
      seedDatabase(db);
      setIsDbReady(true);
    } catch (error) {
      console.error('[DB] Init failed:', error);
      setDbError(error instanceof Error ? error.message : 'Datenbankfehler');
    }
  }, []);

  if (dbError) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <Text style={{ color: COLORS.danger, fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>
          Datenbankfehler
        </Text>
        <Text style={{ color: COLORS.textSecondary, fontSize: 14, textAlign: 'center' }}>
          {dbError}
        </Text>
      </View>
    );
  }

  if (!isDbReady) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ color: COLORS.textSecondary, marginTop: 16, fontSize: 14 }}>
          Datenbank wird initialisiert...
        </Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" translucent={false} backgroundColor={COLORS.surface} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.surface },
          headerTintColor: COLORS.text,
          contentStyle: { backgroundColor: COLORS.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="substance/[unNumber]"
          options={{ title: 'Stoffdetails' }}
        />
        <Stack.Screen
          name="calculator/evacuation"
          options={{ title: 'Absperrradien-Rechner' }}
        />
        <Stack.Screen
          name="calculator/evacuation-map"
          options={{ title: 'Absperrradius auf Karte' }}
        />
        <Stack.Screen
          name="calculator/air-supply"
          options={{ title: 'Atemluft-Rechner' }}
        />
        <Stack.Screen
          name="legal/imprint"
          options={{ title: 'Rechtliches & Datenschutz' }}
        />
        <Stack.Screen
          name="tools/gams-checklist"
          options={{ title: 'GAMS-Checkliste' }}
        />
        <Stack.Screen
          name="tools/ppm-converter"
          options={{ title: 'PPM-Umrechnung' }}
        />
        <Stack.Screen
          name="tools/beaufort-scale"
          options={{ title: 'Beaufort-Skala' }}
        />
        <Stack.Screen
          name="tools/volume-estimator"
          options={{ title: 'Volumenabschätzung' }}
        />
      </Stack>
    </>
  );
}
