import { create } from 'zustand'
import type { AssetsData } from '@/lib/api/assets'
import type { BudgetData } from '@/lib/api/budget'
import type { HistoryData } from '@/lib/api/history'
import type { AnalyticsData } from '@/lib/api/analytics'
import type { FixedCostsData } from '@/lib/api/fixed-costs'
import type { ReportData } from '@/lib/api/report'
import type { HomeData } from '@/lib/api/home'

interface DataCacheState {
  home: HomeData | null
  assets: AssetsData | null
  budget: BudgetData | null
  history: HistoryData | null
  analytics: AnalyticsData | null
  fixedCosts: FixedCostsData | null
  report: ReportData | null
  reportAnalytics: AnalyticsData | null

  setHome: (d: HomeData) => void
  setAssets: (d: AssetsData) => void
  setBudget: (d: BudgetData) => void
  setHistory: (d: HistoryData | null) => void
  setAnalytics: (d: AnalyticsData) => void
  setFixedCosts: (d: FixedCostsData) => void
  setReport: (d: ReportData, analytics: AnalyticsData) => void
  clearAll: () => void
}

export const useDataCache = create<DataCacheState>((set) => ({
  home: null,
  assets: null,
  budget: null,
  history: null,
  analytics: null,
  fixedCosts: null,
  report: null,
  reportAnalytics: null,

  setHome: (d) => set({ home: d }),
  setAssets: (d) => set({ assets: d }),
  setBudget: (d) => set({ budget: d }),
  setHistory: (d) => set({ history: d }),
  setAnalytics: (d) => set({ analytics: d }),
  setFixedCosts: (d) => set({ fixedCosts: d }),
  setReport: (d, a) => set({ report: d, reportAnalytics: a }),
  clearAll: () => set({
    home: null, assets: null, budget: null, history: null,
    analytics: null, fixedCosts: null, report: null, reportAnalytics: null,
  }),
}))
