import { supabase } from '@/lib/supabase'
import { monthString } from '@/lib/date'
import type { Account, Budget, Card, Expense, FixedCost, User } from '@spenlog/types'

export interface AssetsData {
  profile: User | null
  accounts: Account[]
  cards: Card[]
  fixedCosts: FixedCost[]
  budgets: Budget[]
  expenses: Pick<Expense, 'id' | 'name' | 'amount' | 'category' | 'date' | 'payment_method'>[]
  categories: { name: string }[]
  thisMonthSpent: number
  categorySpent: Record<string, number>
}

export async function getAssetsData(userId: string): Promise<AssetsData> {
  const thisMonth = monthString()
  const nextMonth = monthString(1)

  const [
    { data: profile },
    { data: accounts },
    { data: cards },
    { data: fixedCosts },
    { data: expenses },
    { data: budgets },
    { data: categories },
  ] = await Promise.all([
    supabase.from('users').select('*').eq('id', userId).single(),
    supabase.from('accounts').select('*').eq('user_id', userId),
    supabase.from('cards').select('*').eq('user_id', userId),
    supabase.from('fixed_costs').select('*').eq('user_id', userId),
    supabase.from('expenses').select('id, name, amount, category, date, payment_method').eq('user_id', userId)
      .gte('date', `${thisMonth}-01`).lt('date', `${nextMonth}-01`).order('date', { ascending: false }),
    supabase.from('budgets').select('*').eq('user_id', userId).eq('month', thisMonth),
    supabase.from('categories').select('*').eq('user_id', userId).order('sort_order'),
  ])

  const categorySpent: Record<string, number> = {}
  expenses?.forEach(e => {
    categorySpent[e.category] = (categorySpent[e.category] ?? 0) + e.amount
  })

  return {
    profile: (profile as User) ?? null,
    accounts: (accounts as Account[]) ?? [],
    cards: (cards as Card[]) ?? [],
    fixedCosts: (fixedCosts as FixedCost[]) ?? [],
    budgets: (budgets as Budget[]) ?? [],
    expenses: expenses ?? [],
    categories: categories ?? [],
    thisMonthSpent: expenses?.reduce((s, e) => s + e.amount, 0) ?? 0,
    categorySpent,
  }
}

export async function addAccount(userId: string, vals: { name: string; bank: string; balance: number; type: string }) {
  return supabase.from('accounts').insert({
    user_id: userId, name: vals.name, bank: vals.bank,
    balance: vals.balance, type: vals.type || '입출금',
  }).select().single()
}

export async function deleteAccount(id: string) {
  return supabase.from('accounts').delete().eq('id', id)
}

export async function addCard(userId: string, vals: {
  name: string; bank: string; due_day?: number | null
  billing_start_day?: number | null; linked_account_id?: string | null
}) {
  return supabase.from('cards').insert({
    user_id: userId, name: vals.name, bank: vals.bank,
    due_day: vals.due_day ?? null,
    billing_start_day: vals.billing_start_day ?? null,
    linked_account_id: vals.linked_account_id ?? null,
  }).select().single()
}

export async function deleteCard(id: string) {
  return supabase.from('cards').delete().eq('id', id)
}

export async function updateIncome(userId: string, income: number, savingGoal: number) {
  return supabase.from('users').update({ income, saving_goal: savingGoal }).eq('id', userId)
}

export async function updateAccount(id: string, updates: {
  name?: string; bank?: string; type?: string; balance?: number
}) {
  return supabase.from('accounts').update(updates).eq('id', id)
}

export async function updateCard(id: string, updates: {
  name?: string; bank?: string; due_day?: number | null; billing_start_day?: number | null; linked_account_id?: string | null
}) {
  return supabase.from('cards').update(updates).eq('id', id)
}

export async function getMonthExpensesTotal(userId: string, month: string, paymentMethod?: string): Promise<number> {
  const [y, m] = month.split('-').map(Number)
  const nextY = m === 12 ? y + 1 : y
  const nextM = m === 12 ? 1 : m + 1
  const nextMonth = `${nextY}-${String(nextM).padStart(2, '0')}`
  let query = supabase.from('expenses')
    .select('amount')
    .eq('user_id', userId)
    .gte('date', `${month}-01`)
    .lt('date', `${nextMonth}-01`)
    .or('type.is.null,and(type.neq.savings,type.neq.transfer)')
  if (paymentMethod) {
    query = query.eq('payment_method', paymentMethod)
  }
  const { data } = await query
  return (data ?? []).reduce((s, e) => s + e.amount, 0)
}
