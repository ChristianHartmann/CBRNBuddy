import { View, Text, StyleSheet } from 'react-native';

import { COLORS } from '../../constants/colors';

const styles = StyleSheet.create({
  box: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.secondary,
  },
  text: {
    color: COLORS.secondary,
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

/**
 * The reminder that a calculation is an aid, not a decision.
 *
 * Takes the text rather than owning one: the calculation modules return the wording
 * that fits their result, and having it in a single place per calculation is what keeps
 * it from drifting.
 */
export const Disclaimer = ({ text }: { text: string }) => (
  <View style={styles.box}>
    <Text style={styles.text}>{text}</Text>
  </View>
);
