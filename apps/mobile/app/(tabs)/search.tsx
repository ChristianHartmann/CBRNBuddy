import { useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SearchInput } from '../../components/search-input';
import { HazmatCard } from '../../components/hazmat-card';
import { useSearchStore } from '../../lib/stores/search-store';
import type { ISearchResult } from '../../lib/database/search';
import { COLORS } from '../../constants/colors';

const CONTENT_CONTAINER_STYLE = { paddingTop: 8, paddingBottom: 24 };

const keyExtractor = (item: ISearchResult) => `${item.un_number}-${item.id}`;

export default function SearchScreen() {
  const { query, results, isLoading, error, setQuery, clearSearch } = useSearchStore();
  const router = useRouter();

  const handleSubstancePress = useCallback(
    (unNumber: string) => router.push(`/substance/${unNumber}`),
    [router]
  );

  const renderItem = useCallback(
    ({ item }: { item: ISearchResult }) => (
      <HazmatCard substance={item} onPress={handleSubstancePress} />
    ),
    [handleSubstancePress]
  );

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={{ alignItems: 'center', marginTop: 48 }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      );
    }

    if (error) {
      return (
        <View style={{ alignItems: 'center', marginTop: 48, paddingHorizontal: 32 }}>
          <Text style={{ color: COLORS.danger, fontSize: 16, textAlign: 'center' }}>{error}</Text>
        </View>
      );
    }

    if (query.trim()) {
      return (
        <View style={{ alignItems: 'center', marginTop: 48, paddingHorizontal: 32 }}>
          <Text style={{ color: COLORS.textSecondary, fontSize: 16, textAlign: 'center' }}>
            Kein Stoff gefunden
          </Text>
        </View>
      );
    }

    return (
      <View style={{ alignItems: 'center', marginTop: 64, paddingHorizontal: 32 }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>{'\u{1F9EA}'}</Text>
        <Text style={{ color: COLORS.textSecondary, fontSize: 16, textAlign: 'center' }}>
          Suche nach UN-Nummer, Stoffname oder Kemler-Zahl eingeben
        </Text>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <SearchInput
        value={query}
        onChangeText={setQuery}
        onClear={clearSearch}
      />
      <FlatList
        data={results}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={CONTENT_CONTAINER_STYLE}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={5}
      />
    </View>
  );
}
