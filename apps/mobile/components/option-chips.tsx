import { View, Text, Pressable, StyleSheet } from 'react-native';

import { COLORS } from '../constants/colors';

interface IOptionChipsProps {
  options: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  /** Prepended to each option's accessibility label, e.g. "Variante". */
  accessibilityLabelPrefix?: string;
  /** Explains what the options mean. Hidden along with the chips when there is one option. */
  hint?: string;
}

const styles = StyleSheet.create({
  hint: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: COLORS.surfaceLight,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    // Large enough to hit while wearing gloves.
    minHeight: 44,
    justifyContent: 'center',
  },
  chipActive: {
    borderColor: COLORS.secondary,
  },
  chipText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: 'bold',
  },
  chipTextActive: {
    color: COLORS.text,
  },
});

/**
 * A row of selectable chips. Renders nothing for fewer than two options: with a single
 * entry there is no choice to present, and showing one lone chip suggests otherwise.
 */
export const OptionChips = ({
  options,
  selectedIndex,
  onSelect,
  accessibilityLabelPrefix,
  hint,
}: IOptionChipsProps) => {
  if (options.length < 2) {
    return null;
  }

  return (
    <>
      {hint && <Text style={styles.hint}>{hint}</Text>}
      <View style={styles.row}>
        {options.map((option, index) => {
          const isSelected = index === selectedIndex;
          return (
            <Pressable
              key={`${option}-${index}`}
              style={[styles.chip, isSelected && styles.chipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={
                accessibilityLabelPrefix ? `${accessibilityLabelPrefix} ${option}` : option
              }
              onPress={() => onSelect(index)}
            >
              <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );
};
