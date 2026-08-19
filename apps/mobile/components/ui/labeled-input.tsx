import { View, Text, TextInput, StyleSheet, type KeyboardTypeOptions } from 'react-native';

import { COLORS } from '../../constants/colors';
import { SURFACE } from './theme';

interface ILabeledInputProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  /** Shown below the field, for units or thresholds. */
  hint?: string;
  keyboardType?: KeyboardTypeOptions;
  maxLength?: number;
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: COLORS.background,
    // Set through style rather than a class: NativeWind does not apply text colour
    // reliably to TextInput.
    color: COLORS.text,
    fontSize: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.surfaceLight,
    minHeight: 48,
  },
  hint: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 8,
  },
});

/**
 * Labelled text field. The label doubles as the accessibility label, so the field can
 * be found by the same words the user reads.
 */
export const LabeledInput = ({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  keyboardType,
  maxLength,
}: ILabeledInputProps) => (
  <View>
    <Text style={SURFACE.label}>{label}</Text>
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={COLORS.textSecondary}
      keyboardType={keyboardType}
      maxLength={maxLength}
      accessibilityLabel={label}
    />
    {hint && <Text style={styles.hint}>{hint}</Text>}
  </View>
);
