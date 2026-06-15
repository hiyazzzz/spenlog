import { supabase } from '@/lib/supabase'
import dayjs from 'dayjs'
import type { Expense } from '@spenlog/types'

export interface HistoryData {
  expenses: Expense[]
  paymentMethods: string[]
  userCategories: string[]
}

export async function getHistoryData(userId: string): Promise<HistoryData> {
  const from = dayjs().subtract(2, 'month').startOf('month').format('YYYY-MM-DD')

  const [{ data: expenses }, { data: categories }] = await Promise.all([
    supabase.from('expenses').select('*').eq('user_id', userId)
      .gte('date', from).order('date', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('categories').select('name').eq('user_id', userId).eq('is_hidden', false).order('sort_order'),
  ])

  const userCategories = (categories ?? []).map((c: { name: string }) => c.name)
  const paymentMethods = [...new Set(
    (expenses ?? []).map((e: Expense) => e.payment_method).filter(Boolean)
  )] as string[]

  return {
    expenses: (expenses as Expense[]) ?? [],
    paymentMethods,
    userCategories,
  }
}

export async function updateExpense(id: string, updates: Partial<Expense>) {
  return supabase.from('expenses').update(updates).eq('id', id)
}
