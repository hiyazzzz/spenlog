import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_KEY = '@spenlog/theme'

interface ThemeState {
  theme: string
  setTheme: (theme: string) => void
  loadTheme: () => Promise<void>
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: 'Burgundy',
  setTheme: (theme) => {
    set({ theme })
    AsyncStorage.setItem(STORAGE_KEY, theme)
  },
  loadTheme: async () => {
    const stored = await AsyncStorage.getItem(STORAGE_KEY)
    if (stored) set({ theme: stored })
  },
}))
