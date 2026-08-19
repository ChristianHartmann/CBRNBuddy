import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import { COLORS } from '../../constants/colors';
import { LabeledInput } from '../../components/ui/labeled-input';
import { Screen } from '../../components/ui/screen';
import { Section } from '../../components/ui/section';
import { SURFACE } from '../../components/ui/theme';

// mg/m³ = ppm × Molmasse / 24.1 (bei 20°C, 1013 hPa)
const MOLAR_VOLUME = 24.1;

const COMMON_SUBSTANCES = [
  { name: 'Chlor (Cl₂)', molarMass: 70.9 },
  { name: 'Ammoniak (NH₃)', molarMass: 17.03 },
  { name: 'Schwefelwasserstoff (H₂S)', molarMass: 34.08 },
  { name: 'Schwefeldioxid (SO₂)', molarMass: 64.07 },
  { name: 'Kohlenmonoxid (CO)', molarMass: 28.01 },
  { name: 'Blausäure (HCN)', molarMass: 27.03 },
  { name: 'Phosgen (COCl₂)', molarMass: 98.92 },
  { name: 'Stickstoffdioxid (NO₂)', molarMass: 46.01 },
  { name: 'Benzol (C₆H₆)', molarMass: 78.11 },
  { name: 'Formaldehyd (CH₂O)', molarMass: 30.03 },
];

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.surfaceLight,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  chipSelected: {
    borderColor: COLORS.primary,
  },
  chipText: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  chipTextSelected: {
    color: COLORS.text,
  },
  pair: {
    flexDirection: 'row',
    gap: 12,
  },
  pairHalf: {
    flex: 1,
  },
  formula: {
    color: COLORS.textSecondary,
    fontSize: 11,
    textAlign: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    fontStyle: 'italic',
  },
});

export default function PPMConverterScreen() {
  const [ppm, setPpm] = useState('');
  const [mgm3, setMgm3] = useState('');
  const [molarMass, setMolarMass] = useState('');
  const [selectedSubstance, setSelectedSubstance] = useState<string | null>(null);

  const molarMassNum = parseFloat(molarMass);
  const isValidMass = Number.isFinite(molarMassNum) && molarMassNum > 0;

  const handlePpmChange = (value: string) => {
    setPpm(value);
    const ppmNum = parseFloat(value);
    setMgm3(
      Number.isFinite(ppmNum) && isValidMass
        ? ((ppmNum * molarMassNum) / MOLAR_VOLUME).toFixed(2)
        : ''
    );
  };

  const handleMgm3Change = (value: string) => {
    setMgm3(value);
    const mgNum = parseFloat(value);
    setPpm(
      Number.isFinite(mgNum) && isValidMass
        ? ((mgNum * MOLAR_VOLUME) / molarMassNum).toFixed(2)
        : ''
    );
  };

  const selectSubstance = (name: string, mass: number) => {
    setSelectedSubstance(name);
    setMolarMass(mass.toString());
    const ppmNum = parseFloat(ppm);
    if (Number.isFinite(ppmNum)) {
      setMgm3(((ppmNum * mass) / MOLAR_VOLUME).toFixed(2));
    }
  };

  return (
    <Screen>
      <Section>
        <Text style={SURFACE.label}>Häufige Stoffe (Molmasse vorbelegen)</Text>
        <View style={styles.chipRow}>
          {COMMON_SUBSTANCES.map((s) => {
            const isSelected = selectedSubstance === s.name;
            return (
              <Pressable
                key={s.name}
                style={[styles.chip, isSelected && styles.chipSelected]}
                onPress={() => selectSubstance(s.name, s.molarMass)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${s.name}, Molmasse ${s.molarMass}`}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                  {s.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Section>

      <Section>
        <LabeledInput
          label="Molmasse (g/mol)"
          value={molarMass}
          onChangeText={(value) => {
            setMolarMass(value);
            setSelectedSubstance(null);
          }}
          placeholder="z.B. 70.9"
          keyboardType="numeric"
        />
      </Section>

      <Section>
        <View style={styles.pair}>
          <View style={styles.pairHalf}>
            <LabeledInput
              label="ppm"
              value={ppm}
              onChangeText={handlePpmChange}
              placeholder="ppm"
              keyboardType="numeric"
            />
          </View>
          <View style={styles.pairHalf}>
            <LabeledInput
              label="mg/m³"
              value={mgm3}
              onChangeText={handleMgm3Change}
              placeholder="mg/m³"
              keyboardType="numeric"
            />
          </View>
        </View>
      </Section>

      <Text style={styles.formula}>
        mg/m³ = ppm × Molmasse / {MOLAR_VOLUME} (bei 20°C, 1013 hPa)
      </Text>
    </Screen>
  );
}
