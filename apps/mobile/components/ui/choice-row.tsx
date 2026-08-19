import { View, Text, Pressable, StyleSheet } from 'react-native';

import { COLORS } from '../../constants/colors';

export interface IChoice<T> {
  value: T;
  label: string;
  /** Second line under the label, for units or an explanation. */
  description?: string;
  /** Decoration above the label. Deliberately kept out of the accessibility label. */
  icon?: string;
}

interface IChoiceRowProps<T> {
  /** Names the group for assistive technology, e.g. "Flaschendruck". */
  label: string;
  options: IChoice<T>[];
  selected: T;
  onSelect: (value: T) => void;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  option: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  optionSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  optionUnselected: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.surfaceLight,
  },
  icon: {
    fontSize: 22,
    marginBottom: 2,
  },
  label: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  description: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 2,
    textAlign: 'center',
  },
});

/**
 * One choice out of a handful, side by side. Reports the chosen value rather than its
 * index, so callers never translate back and forth.
 */
export const ChoiceRow = <T extends string | number>({
  label,
  options,
  selected,
  onSelect,
}: IChoiceRowProps<T>) => (
  <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={label}>
    {options.map((option) => {
      const isSelected = option.value === selected;
      return (
        <Pressable
          key={String(option.value)}
          style={[styles.option, isSelected ? styles.optionSelected : styles.optionUnselected]}
          onPress={() => onSelect(option.value)}
          accessibilityRole="radio"
          accessibilityState={{ selected: isSelected }}
          accessibilityLabel={option.label}
          accessibilityHint={option.description}
        >
          {option.icon && <Text style={styles.icon}>{option.icon}</Text>}
          <Text
            style={[styles.label, { color: isSelected ? COLORS.text : COLORS.textSecondary }]}
          >
            {option.label}
          </Text>
          {option.description && <Text style={styles.description}>{option.description}</Text>}
        </Pressable>
      );
    })}
  </View>
);
