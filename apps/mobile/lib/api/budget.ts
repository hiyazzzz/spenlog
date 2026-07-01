import { supabase } from '@/lib/supabase'
import { monthString } from '@/lib/date'
import type { Budget } from '@spenlog/types'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://spenlog-nr7t.vercel.app'

const DEFAULT_BUDGET_CATEGORIES = ['생활비', '고정비', '활동비', '친목비', '예비비']

export interface BudgetData {
  budgets: Budget[]
  expenses: { category: string; amount: number }[]
  income: number
  fixedSavings: number
  recentExpenses: { category: string; amount: number; month: string }[]
  customCategories: string[]
}

export async function getBudgetData(userId: string): Promise<BudgetData> {
  const thisMonth = monthString()
  const nextMonth = monthString(1)
  const threeMonthsAgo = monthString(-2)

  const [
    { data: budgets },
    { data: expenses },
    { data: profile },
    { data: fixedCosts },
    { data: recentExpenses },
    { data: categories },
  ] = await Promise.all([
    supabase.from('budgets').select('*').eq('user_id', userId).eq('month', thisMonth),
    supabase.from('expenses').select('category, amount, type').eq('user_id', userId)
      .gte('date', `${thisMonth}-01`)
      .lt('date', `${nextMonth}-01`)
      .or('type.is.null,type.eq.expense'),
    supabase.from('users').select('income').eq('id', userId).single(),
    supabase.from('fixed_costs').select('amount, kind').eq('user_id', userId),
    supabase.from('expenses').select('category, amount, date').eq('user_id', userId)
      .or('type.is.null,type.eq.expense')
      .gte('date', `${threeMonthsAgo}-01`)
      .lt('date', `${nextMonth}-01`),
    supabase.from('categories').select('name, is_hidden').eq('user_id', userId).order('sort_order'),
  ])

  const fixedSavings = fixedCosts?.filter(f => f.kind === '고정저축').reduce((s, f) => s + f.amount, 0) ?? 0

  const catNames = (categories ?? []).filter(c => !c.is_hidden).map(c => c.name).filter(n => n !== '수입')
  const customCategories = catNames.length > 0 ? catNames : DEFAULT_BUDGET_CATEGORIES

  const recentExpensesWithMonth = (recentExpenses ?? []).map(e => ({
    category: e.category,
    amount: e.amount,
    month: (e.date as string).slice(0, 7),
  }))

  return {
    budgets: (budgets as Budget[]) ?? [],
    expenses: expenses ?? [],
    income: profile?.income ?? 0,
    fixedSavings,
    recentExpenses: recentExpensesWithMonth,
    customCategories,
  }
}

export async function saveBudgets(
  userId: string,
  month: string,
  categories: string[],
  enabledCats: Record<string, boolean>,
  amounts: Record<string, string>,
  source: 'manual' | 'ai' = 'manual'
) {
  const onCats = categories.filter(cat => enabledCats[cat])
  const offCats = categories.filter(cat => !enabledCats[cat])

  if (onCats.length > 0) {
    const upsertData = onCats.map(cat => ({
      user_id: userId,
      category: cat,
      amount: parseInt(amounts[cat] || '0') || 0,
      month,
      source,
    }))
    await supabase.from('budgets').upsert(upsertData, { onConflict: 'user_id,category,month' })
  }

  if (offCats.length > 0) {
    await supabase.from('budgets')
      .delete()
      .eq('user_id', userId)
      .eq('month', month)
      .in('category', offCats)
  }
}

export function fallbackBudgetAmounts(income: number, fixedSavings: number, categories: string[]): Record<string, number> {
  const spendBudget = income - fixedSavings
  const dist: Record<string, number> = { 생활비: 0.40, 고정비: 0.35, 활동비: 0.25 }
  const spendCats = categories.filter(c => c !== '수입')
  const BASE_RATIO = 0.1
  const rawRatios: Record<string, number> = Object.fromEntries(
    spendCats.map(cat => [cat, cat in dist ? (dist[cat] ?? 0) : BASE_RATIO])
  )
  const totalRatio = Object.values(rawRatios).reduce((s, r) => s + r, 0)
  return Object.fromEntries(
    spendCats.map(cat => [cat, Math.round(spendBudget * rawRatios[cat] / totalRatio)])
  )
}

export interface RecommendInput {
  income: number
  fixedSavings: number
  recentExpenses: { category: string; amount: number; month: string }[]
  currentBudgets: { category: string; amount: number }[]
  categories: string[]
}

export interface RecommendResult {
  amounts: Record<string, number>
  reason?: string
}

export async function recommendBudget(input: RecommendInput): Promise<RecommendResult> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 12000)
    let res: Response
    try {
      res = await fetch(`${API_URL}/api/budget-recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timer)
    }
    const data = await res.json()
    if (!res.ok || data.error) throw new Error(data.error ?? 'API_ERROR')
    return { amounts: data.amounts, reason: data.reason }
  } catch {
    return { amounts: fallbackBudgetAmounts(input.income, input.fixedSavings, input.categories) }
  }
}
