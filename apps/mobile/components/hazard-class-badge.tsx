import { memo } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { HAZMAT_CLASSES } from '../constants/hazmat-classes';
import { COLORS } from '../constants/colors';

interface IHazardClassBadgeProps {
  classCode: string;
}

const toRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.text,
  },
});

export const HazardClassBadge = memo(function HazardClassBadge({ classCode }: IHazardClassBadgeProps) {
  const hazClass = HAZMAT_CLASSES[classCode as keyof typeof HAZMAT_CLASSES];
  const badgeColor = hazClass?.color ?? COLORS.textMuted;

  return (
    <View style={[styles.badge, { backgroundColor: toRgba(badgeColor, 0.2), borderColor: badgeColor }]}>
      <Text style={styles.label}>
        {classCode}{hazClass ? ` ${hazClass.name}` : ''}
      </Text>
    </View>
  );
});
