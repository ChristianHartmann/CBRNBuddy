import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { COLORS } from '../constants/colors';

interface IERICardSectionProps {
  title: string;
  icon: string;
  items: string[];
  defaultOpen?: boolean;
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.surfaceLight,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 48,
  },
  icon: {
    fontSize: 18,
    marginRight: 10,
  },
  title: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: 'bold',
  },
  chevron: {
    color: COLORS.textSecondary,
    fontSize: 16,
  },
  content: {
    backgroundColor: COLORS.background,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  item: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  bullet: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginRight: 8,
    marginTop: 1,
  },
  itemText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 20,
  },
});

export const ERICardSection = ({ title, icon, items, defaultOpen = false }: IERICardSectionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (items.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.header}
        onPress={() => setIsOpen(!isOpen)}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${items.length} Punkte`}
        accessibilityState={{ expanded: isOpen }}
      >
        <Text style={styles.icon}>{icon}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.chevron}>{isOpen ? '\u25B2' : '\u25BC'}</Text>
      </Pressable>
      {isOpen && (
        <View style={styles.content}>
          {items.map((item, index) => (
            <View key={`${item.slice(0, 40)}-${index}`} style={styles.item}>
              <Text style={styles.bullet}>{'\u2022'}</Text>
              <Text style={styles.itemText}>{item}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};
