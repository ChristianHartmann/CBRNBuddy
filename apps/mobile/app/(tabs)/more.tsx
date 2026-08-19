import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Linking, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '../../constants/colors';
import { CONTACT_EMAIL } from '../../constants/contact';
import { Screen } from '../../components/ui/screen';
import { Section } from '../../components/ui/section';
import { getDatabase } from '../../lib/database/connection';

const FEEDBACK_URL = `mailto:${CONTACT_EMAIL}?subject=CBRN-Buddy%20Feedback`;

const styles = StyleSheet.create({
  menuItem: {
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  menuText: {
    color: COLORS.text,
    fontSize: 16,
  },
  menuDescription: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
});

export default function MoreScreen() {
  const router = useRouter();
  const [dbStats, setDbStats] = useState({ substances: 0, ericards: 0 });

  useEffect(() => {
    try {
      const db = getDatabase();
      const subs = db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM substances');
      const eris = db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM ericards');
      setDbStats({
        substances: subs?.count ?? 0,
        ericards: eris?.count ?? 0,
      });
    } catch {
      // DB not ready yet
    }
  }, []);

  return (
    <Screen>
      <Section title="Rechner">

        <Pressable
          style={styles.menuItem}
          onPress={() => router.push('/calculator/evacuation')}
          accessibilityRole="button"
          accessibilityLabel="Absperrradien-Rechner"
        >
          <Text style={styles.menuIcon}>{'\u{1F6A8}'}</Text>
          <View>
            <Text style={styles.menuText}>Absperrradien-Rechner</Text>
            <Text style={styles.menuDescription}>Absperr- und Schutzabstände nach ERG 2024</Text>
          </View>
        </Pressable>

        <Pressable
          style={styles.menuItem}
          onPress={() => router.push('/calculator/air-supply')}
          accessibilityRole="button"
          accessibilityLabel="Atemluft-Rechner"
        >
          <Text style={styles.menuIcon}>{'\u{1F3AD}'}</Text>
          <View>
            <Text style={styles.menuText}>Atemluft-Rechner</Text>
            <Text style={styles.menuDescription}>PA-Einsatzzeit nach FwDV 7</Text>
          </View>
        </Pressable>

        <Pressable
          style={styles.menuItem}
          onPress={() => router.push('/tools/ppm-converter')}
          accessibilityRole="button"
          accessibilityLabel="PPM-Umrechnung"
        >
          <Text style={styles.menuIcon}>{'\u{1F9EA}'}</Text>
          <View>
            <Text style={styles.menuText}>PPM-Umrechnung</Text>
            <Text style={styles.menuDescription}>ppm ↔ mg/m³ Konzentrationsumrechnung</Text>
          </View>
        </Pressable>

        <Pressable
          style={styles.menuItem}
          onPress={() => router.push('/tools/volume-estimator')}
          accessibilityRole="button"
          accessibilityLabel="Volumenabschätzung"
        >
          <Text style={styles.menuIcon}>{'\u{1F4E6}'}</Text>
          <View>
            <Text style={styles.menuText}>Volumenabschätzung</Text>
            <Text style={styles.menuDescription}>Behältervolumen berechnen</Text>
          </View>
        </Pressable>
      </Section>

      <Section title="Einsatz-Tools">

        <Pressable
          style={styles.menuItem}
          onPress={() => router.push('/tools/gams-checklist')}
          accessibilityRole="button"
          accessibilityLabel="GAMS-Checkliste"
        >
          <Text style={styles.menuIcon}>{'\u{2705}'}</Text>
          <View>
            <Text style={styles.menuText}>GAMS-Checkliste</Text>
            <Text style={styles.menuDescription}>Gefahrstoff-Ersteinsatz Checkliste</Text>
          </View>
        </Pressable>

        <Pressable
          style={styles.menuItem}
          onPress={() => router.push('/tools/beaufort-scale')}
          accessibilityRole="button"
          accessibilityLabel="Beaufort-Skala"
        >
          <Text style={styles.menuIcon}>{'\u{1F4A8}'}</Text>
          <View>
            <Text style={styles.menuText}>Beaufort-Skala</Text>
            <Text style={styles.menuDescription}>Windstärke vor Ort abschätzen</Text>
          </View>
        </Pressable>
      </Section>

      <Section title="Info">

        <View style={styles.menuItem}>
          <Text style={styles.menuIcon}>{'\u{2139}'}</Text>
          <View>
            <Text style={styles.menuText}>CBRN-Buddy v0.1.0</Text>
            <Text style={styles.menuDescription}>
              {dbStats.substances.toLocaleString('de-DE')} Stoffe, {dbStats.ericards.toLocaleString('de-DE')} ERICards
            </Text>
          </View>
        </View>

        <Pressable
          style={styles.menuItem}
          onPress={() => router.push('/legal/imprint')}
          accessibilityRole="button"
          accessibilityLabel="Impressum und Datenschutz"
        >
          <Text style={styles.menuIcon}>{'\u{1F4C4}'}</Text>
          <View>
            <Text style={styles.menuText}>Rechtliches & Datenschutz</Text>
          </View>
        </Pressable>

        {CONTACT_EMAIL && (
          <Pressable
            style={styles.menuItem}
            onPress={async () => {
              const supported = await Linking.canOpenURL(FEEDBACK_URL);
              if (supported) {
                await Linking.openURL(FEEDBACK_URL);
              } else {
                Alert.alert('Kein E-Mail-Programm', `Bitte sende dein Feedback an ${CONTACT_EMAIL}`);
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="Feedback senden"
          >
            <Text style={styles.menuIcon}>{'\u{1F4E7}'}</Text>
            <View>
              <Text style={styles.menuText}>Feedback senden</Text>
              <Text style={styles.menuDescription}>{CONTACT_EMAIL}</Text>
            </View>
          </Pressable>
        )}
      </Section>
    </Screen>
  );
}
