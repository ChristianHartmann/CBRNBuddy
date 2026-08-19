import { useState } from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { calculateEvacuationRadius } from '../../lib/calculations/evacuation';
import { COLORS } from '../../constants/colors';
import { Disclaimer } from '../../components/ui/disclaimer';
import { LabeledInput } from '../../components/ui/labeled-input';
import { PrimaryButton } from '../../components/ui/primary-button';
import { ResultCard } from '../../components/ui/result-card';
import { ResultRow } from '../../components/ui/result-row';
import { Screen } from '../../components/ui/screen';
import { Section } from '../../components/ui/section';

const styles = StyleSheet.create({
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLabel: {
    color: COLORS.text,
    fontSize: 16,
    flexShrink: 1,
  },
  warning: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.warning,
  },
  warningText: {
    color: COLORS.warning,
    fontSize: 12,
    textAlign: 'center',
  },
});

/** Metres below one kilometre, kilometres above, since 3900 m reads worse than 3,9 km. */
const formatDistance = (metres: number): { value: string; unit: string } =>
  metres >= 1000
    ? { value: (metres / 1000).toFixed(1), unit: 'km' }
    : { value: String(metres), unit: 'm' };

export default function EvacuationCalculatorScreen() {
  const params = useLocalSearchParams<{ unNumber?: string; hazardClass?: string }>();
  const router = useRouter();

  const [unNumber, setUnNumber] = useState(params.unNumber ?? '');
  const [quantity, setQuantity] = useState('');
  const [isNight, setIsNight] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof calculateEvacuationRadius> | null>(null);

  const handleCalculate = () => {
    // Pass the raw parse result through: the calculation decides what an unknown
    // quantity means. Coercing NaN to 0 here would silently pick the smallest radius.
    setResult(
      calculateEvacuationRadius({
        unNumber,
        hazardClass: params.hazardClass,
        quantity: parseFloat(quantity),
        isNight,
      })
    );
  };

  const protectiveAction = result && formatDistance(result.protectiveActionDistance);

  return (
    <Screen>
      <Section>
        <LabeledInput
          label="UN-Nummer"
          value={unNumber}
          onChangeText={setUnNumber}
          placeholder="z.B. 1017"
          keyboardType="numeric"
          maxLength={4}
        />
      </Section>

      <Section>
        <LabeledInput
          label="Freigesetzte Menge (Liter)"
          value={quantity}
          onChangeText={setQuantity}
          placeholder="z.B. 500"
          keyboardType="numeric"
          hint="Klein: bis 208 L (Fass/Kanister) | Gross: ab 208 L (Tank)"
        />
      </Section>

      <Section>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Nacht (Sonnenuntergang bis -aufgang)</Text>
          <Switch
            value={isNight}
            onValueChange={setIsNight}
            trackColor={{ true: COLORS.primary, false: COLORS.surfaceLight }}
            accessibilityLabel="Nacht-Modus"
          />
        </View>
      </Section>

      <PrimaryButton label="Absperrradius berechnen" onPress={handleCalculate} />

      {result && protectiveAction && (
        <>
          <ResultCard title="Ergebnis" source={result.source}>
            <ResultRow
              label="Sofort-Absperrradius"
              value={result.initialIsolationRadius}
              unit="m"
            />
            <ResultRow
              label="Schutzabstand Lee-Seite"
              value={protectiveAction.value}
              unit={protectiveAction.unit}
            />
            <ResultRow
              label="Freisetzungsart"
              value={result.isLargeSpill ? 'Grosse Freisetzung' : 'Kleine Freisetzung'}
              secondary
            />
          </ResultCard>

          <PrimaryButton
            label="Auf Karte anzeigen"
            accessibilityLabel="Absperrradius auf Karte anzeigen"
            onPress={() =>
              router.push({
                pathname: '/calculator/evacuation-map',
                params: { radius: String(result.initialIsolationRadius), unNumber },
              })
            }
          />

          {result.isFallback && (
            <View style={styles.warning}>
              <Text style={styles.warningText}>
                Kein stoffspezifischer ERG-Eintrag - Pauschalwert verwendet. Fachberater ABC
                hinzuziehen!
              </Text>
            </View>
          )}

          <Disclaimer text={result.disclaimer} />
        </>
      )}
    </Screen>
  );
}
