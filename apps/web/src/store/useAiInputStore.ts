import { create } from 'zustand'

interface AiInputStore {
  prefill: {
    name?: string
    amount?: number
    category?: string
    originalText?: string
  } | null
  setPrefill: (data: AiInputStore['prefill']) => void
  clearPrefill: () => void
}

export const useAiInputStore = create<AiInputStore>((set) => ({
  prefill: null,
  setPrefill: (data) => set({ prefill: data }),
  clearPrefill: () => set({ prefill: null }),
}))
