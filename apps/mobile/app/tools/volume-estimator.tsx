import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { COLORS } from '../../constants/colors';
import { ChoiceRow, type IChoice } from '../../components/ui/choice-row';
import { LabeledInput } from '../../components/ui/labeled-input';
import { ResultCard } from '../../components/ui/result-card';
import { ResultRow } from '../../components/ui/result-row';
import { Screen } from '../../components/ui/screen';
import { Section } from '../../components/ui/section';

type Shape = 'cylinder' | 'cuboid' | 'pool';

interface IShape {
  label: string;
  icon: string;
  formula: string;
  /** The dimensions to ask for, in the order they are entered. All in metres. */
  fields: { key: string; label: string }[];
}

// Each shape declares its own fields, so the form is one loop instead of three nearly
// identical blocks of inputs.
const SHAPES: Record<Shape, IShape> = {
  cylinder: {
    label: 'Zylinder',
    icon: '\u{1F6E2}',
    formula: 'V = π × r² × h',
    fields: [
      { key: 'radius', label: 'Radius (m)' },
      { key: 'height', label: 'Höhe (m)' },
    ],
  },
  cuboid: {
    label: 'Quader',
    icon: '\u{1F4E6}',
    formula: 'V = Länge × Breite × Höhe',
    fields: [
      { key: 'length', label: 'Länge (m)' },
      { key: 'width', label: 'Breite (m)' },
      { key: 'height', label: 'Höhe (m)' },
    ],
  },
  pool: {
    label: 'Lache',
    icon: '\u{1F4A7}',
    formula: 'V = Länge × Breite × Tiefe',
    fields: [
      { key: 'length', label: 'Länge (m)' },
      { key: 'width', label: 'Breite (m)' },
      { key: 'depth', label: 'Tiefe / Schichtdicke (m)' },
    ],
  },
};

const SHAPE_OPTIONS: IChoice<Shape>[] = (Object.keys(SHAPES) as Shape[]).map((value) => ({
  value,
  label: SHAPES[value].label,
  icon: SHAPES[value].icon,
}));

const styles = StyleSheet.create({
  fields: {
    gap: 12,
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

/** Positive, finite metres, or null when a dimension is missing or unusable. */
const readDimensions = (shape: Shape, values: Record<string, string>): number[] | null => {
  const numbers = SHAPES[shape].fields.map((field) => parseFloat(values[field.key]));
  return numbers.every((n) => Number.isFinite(n) && n > 0) ? numbers : null;
};

/** Volume in litres, or null when the dimensions are incomplete. */
const calculateVolume = (shape: Shape, values: Record<string, string>): number | null => {
  const dimensions = readDimensions(shape, values);
  if (!dimensions) {
    return null;
  }

  // Cubic metres to litres.
  const TO_LITRES = 1000;

  if (shape === 'cylinder') {
    const [radius, height] = dimensions;
    return Math.PI * radius * radius * height * TO_LITRES;
  }
  return dimensions.reduce((product, value) => product * value, 1) * TO_LITRES;
};

export default function VolumeEstimatorScreen() {
  const [shape, setShape] = useState<Shape>('cylinder');
  const [values, setValues] = useState<Record<string, string>>({});

  const handleShapeChange = (next: Shape) => {
    setShape(next);
    setValues({});
  };

  const volume = calculateVolume(shape, values);

  return (
    <Screen>
      <Section title="Behälterform">
        <ChoiceRow
          label="Behälterform"
          options={SHAPE_OPTIONS}
          selected={shape}
          onSelect={handleShapeChange}
        />
      </Section>

      <Section title="Abmessungen (in Metern)">
        <View style={styles.fields}>
          {SHAPES[shape].fields.map((field) => (
            <LabeledInput
              key={field.key}
              label={field.label}
              value={values[field.key] ?? ''}
              onChangeText={(value) => setValues((prev) => ({ ...prev, [field.key]: value }))}
              placeholder={field.label}
              keyboardType="numeric"
            />
          ))}
        </View>
      </Section>

      {volume !== null && (
        <ResultCard title="Volumen">
          <ResultRow label="Inhalt" value={volume.toFixed(0)} unit="Liter" />
          {volume >= 1000 && (
            <ResultRow label="Entspricht" value={(volume / 1000).toFixed(1)} unit="m³" secondary />
          )}
        </ResultCard>
      )}

      <Text style={styles.formula}>
        {SHAPES[shape].formula} (Eingabe in Metern, Ergebnis in Litern)
      </Text>
    </Screen>
  );
}
