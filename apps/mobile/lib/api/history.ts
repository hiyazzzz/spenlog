import { supabase } from '@/lib/supabase'
import dayjs from 'dayjs'
import type { Expense } from '@spenlog/types'

export interface HistoryData {
  expenses: Expense[]
  paymentMethods: string[]
  userCategories: string[]
  cardNames: string[]
  accountNames: string[]
}

export async function getHistoryData(userId: string): Promise<HistoryData> {
  const from = dayjs().subtract(2, 'month').startOf('month').format('YYYY-MM-DD')

  const [{ data: expenses }, { data: categories }, { data: cards }, { data: accs }] = await Promise.all([
    supabase.from('expenses').select('*').eq('user_id', userId)
      .gte('date', from).order('date', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('categories').select('name').eq('user_id', userId).eq('is_hidden', false).order('sort_order'),
    supabase.from('cards').select('name').eq('user_id', userId),
    supabase.from('accounts').select('name').eq('user_id', userId),
  ])

  const userCategories = (categories ?? []).map((c: { name: string }) => c.name)
  const cardNames = (cards ?? []).map((c: { name: string }) => c.name)
  const paymentMethods = [...new Set([
    ...cardNames,
    ...(expenses ?? []).map((e: Expense) => e.payment_method).filter(Boolean),
  ])] as string[]

  const accountNames = (accs ?? []).map((a: { name: string }) => a.name)
  return {
    expenses: ((expenses as Expense[]) ?? []).map(e => ({ ...e, type: e.type ?? 'expense' })),
    paymentMethods,
    userCategories,
    cardNames,
    accountNames,
  }
}

export async function updateExpense(id: string, updates: Partial<Expense>) {
  return supabase.from('expenses').update(updates).eq('id', id)
}
