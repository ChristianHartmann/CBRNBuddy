import { memo } from 'react';
import { View, Text, Pressable } from 'react-native';
import type { ISearchResult } from '../lib/database/search';
import { COLORS } from '../constants/colors';
import { HAZMAT_CLASSES } from '../constants/hazmat-classes';
import { HazardClassBadge } from './hazard-class-badge';

interface IHazmatCardProps {
  substance: ISearchResult;
  onPress: (unNumber: string) => void;
}

export const HazmatCard = memo(function HazmatCard({ substance, onPress }: IHazmatCardProps) {
  const handlePress = () => onPress(substance.un_number);
  const classColor = HAZMAT_CLASSES[substance.hazard_class as keyof typeof HAZMAT_CLASSES]?.color ?? COLORS.textSecondary;

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${substance.name_de}, UN ${substance.un_number}`}
      style={{
        backgroundColor: COLORS.surface,
        marginHorizontal: 16,
        marginBottom: 8,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.surfaceLight,
        borderLeftWidth: 4,
        borderLeftColor: classColor,
      }}
    >
      <Text style={{ color: COLORS.text, fontSize: 16, fontWeight: 'bold' }} numberOfLines={2}>
        {substance.name_de}
      </Text>
      <View style={{ flexDirection: 'row', marginTop: 8, gap: 12, alignItems: 'center' }}>
        <Text style={{ color: COLORS.textSecondary, fontSize: 13 }}>
          UN {substance.un_number}
        </Text>
        {substance.kemler_number && (
          <Text style={{ color: COLORS.textSecondary, fontSize: 13 }}>
            Kemler {substance.kemler_number}
          </Text>
        )}
      </View>
      <View style={{ marginTop: 6 }}>
        <HazardClassBadge classCode={substance.hazard_class} />
      </View>
    </Pressable>
  );
});
