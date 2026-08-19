import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Scanner mode: live (vision-camera + YOLO) is the default, photo (expo-camera) the
// fallback. Persisted so the choice survives an app restart.
export type ScanMode = 'photo' | 'live';

interface IScanModeState {
  mode: ScanMode;
  setMode: (mode: ScanMode) => void;
}

export const useScanModeStore = create<IScanModeState>()(
  persist(
    (set) => ({
      mode: 'live',
      setMode: (mode: ScanMode) => set({ mode }),
    }),
    {
      // Key bumped to -v2 so the stored 'scan-mode' from back when 'photo' was the default
      // is ignored, letting the new 'live' default apply on devices that already ran the app.
      name: 'scan-mode-v2',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
