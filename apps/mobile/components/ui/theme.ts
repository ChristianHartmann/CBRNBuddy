import { StyleSheet } from 'react-native';

import { COLORS } from '../../constants/colors';

/**
 * Shared surface styling for the UI primitives.
 *
 * Kept in one place because the screens used to define `container` twelve times and
 * `sectionTitle` four times in four different ways, which made the same thing look
 * different depending on which screen you were on.
 */
export const SURFACE = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    margin: 16,
    marginBottom: 0,
    padding: 16,
    borderRadius: 12,
  },
  title: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginBottom: 6,
  },
});
