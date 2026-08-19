import { View, TextInput, Pressable, Text } from 'react-native';
import { COLORS } from '../constants/colors';

interface ISearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onClear: () => void;
}

export const SearchInput = ({ value, onChangeText, onClear }: ISearchInputProps) => {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
        paddingHorizontal: 16,
        marginHorizontal: 16,
        marginTop: 16,
      }}
    >
      <Text style={{ fontSize: 18, marginRight: 8 }}>{'\u{1F50D}'}</Text>
      <TextInput
        style={{ flex: 1, color: COLORS.text, fontSize: 16, paddingVertical: 16 }}
        placeholder="UN-Nummer, Stoffname oder Kemler-Zahl..."
        placeholderTextColor={COLORS.textSecondary}
        accessibilityLabel="Gefahrstoff-Suche"
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      {value.length > 0 && (
        <Pressable
          onPress={onClear}
          hitSlop={12}
          accessibilityLabel="Suche leeren"
          accessibilityRole="button"
        >
          <Text style={{ color: COLORS.textSecondary, fontSize: 20 }}>{'\u{2715}'}</Text>
        </Pressable>
      )}
    </View>
  );
};
