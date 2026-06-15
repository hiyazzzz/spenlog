import { supabase } from '@/lib/supabase'
import { monthString } from '@/lib/date'
import type { FixedCost } from '@spenlog/types'

export interface FixedCostsData {
  fixedCosts: FixedCost[]
  appliedNames: string[]
  total: number
}

export async function getFixedCostsData(userId: string): Promise<FixedCostsData> {
  const thisMonth = monthString()

  const [{ data: fixedCosts }, { data: appliedExpenses }] = await Promise.all([
    supabase.from('fixed_costs').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
    supabase.from('expenses').select('name').eq('user_id', userId)
      .gte('date', `${thisMonth}-01`).eq('category', '고정비'),
  ])

  return {
    fixedCosts: (fixedCosts as FixedCost[]) ?? [],
    appliedNames: (appliedExpenses ?? []).map(e => e.name),
    total: fixedCosts?.reduce((s, f) => s + f.amount, 0) ?? 0,
  }
}

export async function addFixedCost(userId: string, vals: {
  name: string; amount: number; due_day?: number | null
  type: string; kind: '고정지출' | '고정저축'
}) {
  return supabase.from('fixed_costs').insert({
    user_id: userId, name: vals.name, amount: vals.amount,
    due_day: vals.due_day ?? null, type: vals.type, kind: vals.kind,
  }).select().single()
}

export async function editFixedCost(id: string, updates: Partial<{ name: string; amount: number; due_day: number | null }>) {
  return supabase.from('fixed_costs').update(updates).eq('id', id)
}

export async function deleteFixedCost(id: string) {
  return supabase.from('fixed_costs').delete().eq('id', id)
}
