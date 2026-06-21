import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_KEY = '@spenlog/theme'

interface ThemeState {
  theme: string
  isGuest: boolean
  setTheme: (theme: string) => void
  setIsGuest: (v: boolean) => void
  loadTheme: () => Promise<void>
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: 'Burgundy',
  isGuest: false,
  setTheme: (theme) => {
    set({ theme })
    AsyncStorage.setItem(STORAGE_KEY, theme)
  },
  setIsGuest: (v) => set({ isGuest: v }),
  loadTheme: async () => {
    const stored = await AsyncStorage.getItem(STORAGE_KEY)
    if (stored) set({ theme: stored })
  },
}))
