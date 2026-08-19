import { Pressable, Text, StyleSheet } from 'react-native';

import { COLORS } from '../../constants/colors';

interface IPrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Defaults to the label; set when the label alone is not descriptive enough. */
  accessibilityLabel?: string;
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: COLORS.primary,
    margin: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    // Comfortably hittable with gloves on.
    minHeight: 56,
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
});

/** The one action a screen is about. */
export const PrimaryButton = ({
  label,
  onPress,
  disabled,
  accessibilityLabel,
}: IPrimaryButtonProps) => (
  <Pressable
    style={[styles.button, disabled && styles.disabled]}
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityState={{ disabled: Boolean(disabled) }}
    accessibilityLabel={accessibilityLabel ?? label}
  >
    <Text style={styles.label}>{label}</Text>
  </Pressable>
);
