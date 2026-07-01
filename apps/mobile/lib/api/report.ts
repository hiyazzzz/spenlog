import { supabase } from '@/lib/supabase'
import dayjs from 'dayjs'
import type { User } from '@spenlog/types'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://spenlog-nr7t.vercel.app'

export interface CatData {
  cat: string
  amount: number
  prevAmount: number
  budget: number
  budgetPct: number
  prevDiff: number | null
}

export interface MonthTotal {
  month: string
  label: string
  total: number
}

export interface ReportData {
  profile: User | null
  currentMonth: string
  prevMonth: string
  maxMonth: string
  totalSpent: number
  prevTotalSpent: number
  spendingDiff: number | null
  savingGoal: number
  savedAmount: number
  savingPct: number
  catData: CatData[]
  threeMonths: MonthTotal[] | null
  maxTotal: number
  patternComment: string
  hasEnoughData: boolean
  hasCoachCache: boolean
}

export async function getReportData(userId: string, month?: string): Promise<ReportData> {
  const maxMonth = dayjs().subtract(1, 'month').format('YYYY-MM')
  const defaultMonth = maxMonth
  const rawMonth = month && /^\d{4}-\d{2}$/.test(month) ? month : defaultMonth
  const safeMonth = rawMonth > maxMonth ? maxMonth : rawMonth

  const nextMonth = dayjs(safeMonth).add(1, 'month').format('YYYY-MM')
  const prevMonth = dayjs(safeMonth).subtract(1, 'month').format('YYYY-MM')
  const prev2Month = dayjs(safeMonth).subtract(2, 'month').format('YYYY-MM')

  const [
    { data: profile },
    { data: expenses },
    { data: prevExpenses },
    { data: prev2Expenses },
    { data: budgets },
    { data: categoriesData },
    { data: cachedReport },
  ] = await Promise.all([
    supabase.from('users').select('*').eq('id', userId).single(),
    supabase.from('expenses').select('*').eq('user_id', userId)
      .gte('date', `${safeMonth}-01`).lt('date', `${nextMonth}-01`),
    supabase.from('expenses').select('amount, category, type').eq('user_id', userId)
      .gte('date', `${prevMonth}-01`).lt('date', `${safeMonth}-01`),
    supabase.from('expenses').select('amount, type').eq('user_id', userId)
      .gte('date', `${prev2Month}-01`).lt('date', `${prevMonth}-01`),
    supabase.from('budgets').select('*').eq('user_id', userId).eq('month', safeMonth),
    supabase.from('categories').select('name').eq('user_id', userId).eq('is_hidden', false).order('sort_order'),
    supabase.from('reports').select('ai_coach').eq('user_id', userId).eq('year_month', safeMonth).single(),
  ])

  const totalSpent = expenses?.filter((e: any) => (e.type ?? 'expense') === 'expense').reduce((s: number, e: any) => s + e.amount, 0) ?? 0
  const prevTotalSpent = prevExpenses?.filter((e: any) => (e.type ?? 'expense') === 'expense').reduce((s: number, e: any) => s + e.amount, 0) ?? 0
  const prev2TotalSpent = prev2Expenses?.filter((e: any) => (e.type ?? 'expense') === 'expense').reduce((s: number, e: any) => s + e.amount, 0) ?? 0
  const savingGoal = profile?.saving_goal ?? 0

  // 실제 저축 기록 합산 (홈화면과 동일 기준)
  const savedAmount = expenses?.filter((e: any) => e.type === 'savings').reduce((s: number, e: any) => s + e.amount, 0) ?? 0
  const savingPct = savingGoal > 0 ? Math.min(Math.round((savedAmount / savingGoal) * 100), 100) : 0
  const spendingDiff = prevTotalSpent > 0 ? Math.round(((totalSpent - prevTotalSpent) / prevTotalSpent) * 100) : null

  const userCatNames = (categoriesData ?? []).map((c: any) => c.name)
  const expenseCatNames = [...new Set([
    ...(expenses ?? []).filter((e: any) => (e.type ?? 'expense') === 'expense').map((e: any) => e.category),
    ...(prevExpenses ?? []).filter((e: any) => (e.type ?? 'expense') === 'expense').map((e: any) => e.category),
    ...(budgets ?? []).map((b: any) => b.category),
  ])] as string[]
  const reportCategories = userCatNames.length > 0 ? userCatNames : expenseCatNames

  const catData: CatData[] = reportCategories.map((cat: string) => {
    const amount = expenses?.filter((e: any) => e.category === cat && (e.type ?? 'expense') === 'expense').reduce((s: number, e: any) => s + e.amount, 0) ?? 0
    const prevAmount = prevExpenses?.filter((e: any) => e.category === cat).reduce((s: number, e: any) => s + e.amount, 0) ?? 0
    const budget = budgets?.find((b: any) => b.category === cat)?.amount ?? 0
    const budgetPct = budget > 0 ? Math.min(Math.round((amount / budget) * 100), 100) : 0
    const prevDiff = prevAmount > 0 ? Math.round(((amount - prevAmount) / prevAmount) * 100) : null
    return { cat, amount, prevAmount, budget, budgetPct, prevDiff }
  })

  const threeMonthsRaw: MonthTotal[] = [
    { month: prev2Month, label: dayjs(prev2Month).format('M월'), total: prev2TotalSpent },
    { month: prevMonth, label: dayjs(prevMonth).format('M월'), total: prevTotalSpent },
    { month: safeMonth, label: dayjs(safeMonth).format('M월'), total: totalSpent },
  ]
  const maxTotal = Math.max(...threeMonthsRaw.map(m => m.total), 1)

  let patternComment = ''
  if (prevTotalSpent > 0 && prev2TotalSpent > 0) {
    if (totalSpent < prevTotalSpent && prevTotalSpent < prev2TotalSpent) {
      patternComment = '3개월 연속 줄이고 있어요! 잘하고 있어요 🌿'
    } else if (totalSpent > prevTotalSpent && prevTotalSpent > prev2TotalSpent) {
      patternComment = '3개월째 늘고 있어요. 한번 점검해볼까요?'
    } else {
      patternComment = '들쭉날쭉한 패턴이에요. 고정 예산을 잡아보는 건 어떨까요?'
    }
  }

  return {
    profile: (profile as User) ?? null,
    currentMonth: safeMonth,
    prevMonth,
    maxMonth,
    totalSpent,
    prevTotalSpent,
    spendingDiff,
    savingGoal,
    savedAmount,
    savingPct,
    catData,
    threeMonths: prevTotalSpent > 0 ? threeMonthsRaw : null,
    maxTotal,
    patternComment,
    hasEnoughData: prevTotalSpent > 0,
    hasCoachCache: !!(cachedReport?.ai_coach),
  }
}

export interface Coach {
  step1: string
  step2: string
  step3: string
}

export type CoachErrorCode = 'NO_DATA' | 'API_ERROR' | 'PREMIUM_REQUIRED' | 'MONTH_NOT_COMPLETE'

export interface CoachResult {
  coach?: Coach
  errorCode?: CoachErrorCode
}

export async function getAiCoach(userId: string, report: ReportData): Promise<CoachResult> {
  if (report.totalSpent === 0) return { errorCode: 'NO_DATA' }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)
    let res: Response
    try {
      res = await fetch(`${API_URL}/api/ai-coach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          yearMonth: report.currentMonth,
          totalSpent: report.totalSpent,
          prevTotalSpent: report.prevTotalSpent,
          savingGoal: report.savingGoal,
          savedAmount: report.savedAmount,
          catData: report.catData.map(c => ({ cat: c.cat, amount: c.amount, prevAmount: c.prevAmount, budget: c.budget })),
        }),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timer)
    }
    const data = await res.json()
    if (data.coach) return { coach: data.coach }
    if (data.error === 'PREMIUM_REQUIRED') return { errorCode: 'PREMIUM_REQUIRED' }
    if (data.error === 'MONTH_NOT_COMPLETE') return { errorCode: 'MONTH_NOT_COMPLETE' }
    return { errorCode: 'API_ERROR' }
  } catch {
    return { errorCode: 'API_ERROR' }
  }
}
