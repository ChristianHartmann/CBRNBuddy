import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { COLORS } from '../../constants/colors';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingBottom: 24,
  },
});

/** Scrollable page background. Every screen starts with one. */
export const Screen = ({ children }: { children?: ReactNode }) => (
  <ScrollView style={styles.container} contentContainerStyle={styles.content}>
    {children}
  </ScrollView>
);
