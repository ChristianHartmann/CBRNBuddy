import { create } from 'zustand';
import { getDatabase } from '../database/connection';
import { searchSubstances, type ISearchResult } from '../database/search';

interface ISearchState {
  query: string;
  results: ISearchResult[];
  isLoading: boolean;
  error: string | null;
}

interface ISearchActions {
  setQuery: (query: string) => void;
  clearSearch: () => void;
}

const DEBOUNCE_MS = 300;

export const useSearchStore = create<ISearchState & ISearchActions>((set) => {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const clearTimer = (): void => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  };

  return {
    query: '',
    results: [],
    isLoading: false,
    error: null,

    setQuery: (query: string) => {
      clearTimer();

      if (!query.trim()) {
        set({ query, results: [], isLoading: false, error: null });
        return;
      }

      set({ query, isLoading: true, error: null });

      debounceTimer = setTimeout(() => {
        try {
          const db = getDatabase();
          const results = searchSubstances(db, query);
          set({ results, isLoading: false });
        } catch (err) {
          console.error('[search-store] Search failed:', err);
          set({ results: [], isLoading: false, error: 'Suche fehlgeschlagen' });
        }
      }, DEBOUNCE_MS);
    },

    clearSearch: () => {
      clearTimer();
      set({ query: '', results: [], isLoading: false, error: null });
    },
  };
});
