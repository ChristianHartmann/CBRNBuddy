import { View, Text, StyleSheet } from 'react-native';

import { COLORS } from '../../constants/colors';

interface IResultRowProps {
  label: string;
  value: string | number;
  unit?: string;
  /** Set for secondary figures, which are shown smaller. */
  secondary?: boolean;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  value: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  valueSecondary: {
    fontSize: 16,
  },
  unit: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
});

/**
 * One figure of a result. Label and value are announced together, so assistive
 * technology does not read a bare number without its meaning.
 */
export const ResultRow = ({ label, value, unit, secondary }: IResultRowProps) => (
  <View
    style={styles.row}
    accessible
    accessibilityLabel={`${label}: ${value}${unit ? ` ${unit}` : ''}`}
  >
    <Text style={styles.label}>{label}</Text>
    <View style={styles.valueRow}>
      <Text style={[styles.value, secondary && styles.valueSecondary]}>{value}</Text>
      {unit && <Text style={styles.unit}>{unit}</Text>}
    </View>
  </View>
);
