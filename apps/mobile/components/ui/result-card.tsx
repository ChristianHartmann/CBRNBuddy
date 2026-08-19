import type { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { COLORS } from '../../constants/colors';
import { SURFACE } from './theme';

interface IResultCardProps {
  title: string;
  /** Where the numbers come from, e.g. "ERG 2024, Table 1". Always shown when given. */
  source?: string;
  children?: ReactNode;
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  source: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
  },
});

/**
 * The outcome of a calculation, set apart from the inputs by its border. Carries the
 * source line, because every safety relevant figure has to say where it comes from.
 */
export const ResultCard = ({ title, source, children }: IResultCardProps) => (
  <View style={[SURFACE.card, styles.card]}>
    <Text style={SURFACE.title}>{title}</Text>
    {children}
    {source && <Text style={styles.source}>Quelle: {source}</Text>}
  </View>
);
