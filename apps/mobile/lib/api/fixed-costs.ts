import { supabase } from '@/lib/supabase'
import { monthString } from '@/lib/date'
import type { Account, Card, FixedCost } from '@spenlog/types'

export interface FixedCostsData {
  fixedCosts: FixedCost[]
  appliedNames: string[]
  total: number
  accounts: Account[]
  cards: Card[]
}

export async function getFixedCostsData(userId: string): Promise<FixedCostsData> {
  const thisMonth = monthString()

  const [{ data: fixedCosts }, { data: appliedExpenses }, { data: accounts }, { data: cards }] = await Promise.all([
    supabase.from('fixed_costs').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
    supabase.from('expenses').select('name').eq('user_id', userId)
      .gte('date', `${thisMonth}-01`).eq('category', '고정비'),
    supabase.from('accounts').select('*').eq('user_id', userId),
    supabase.from('cards').select('*').eq('user_id', userId),
  ])

  return {
    fixedCosts: (fixedCosts as FixedCost[]) ?? [],
    appliedNames: (appliedExpenses ?? []).map(e => e.name),
    total: fixedCosts?.reduce((s, f) => s + f.amount, 0) ?? 0,
    accounts: (accounts as Account[]) ?? [],
    cards: (cards as Card[]) ?? [],
  }
}

export async function addFixedCost(userId: string, vals: {
  name: string; amount: number; due_day?: number | null
  type: string; kind: '고정지출' | '고정저축'
  linked_account_id?: string | null
  linked_target_account_id?: string | null
  linked_card_id?: string | null
}) {
  const payload: Record<string, unknown> = {
    user_id: userId, name: vals.name, amount: vals.amount,
    due_day: vals.due_day ?? null, type: vals.type, kind: vals.kind,
    linked_account_id: vals.linked_account_id ?? null,
    linked_target_account_id: vals.linked_target_account_id ?? null,
    linked_card_id: vals.linked_card_id ?? null,
  }

  let result = await supabase.from('fixed_costs').insert(payload).select().single()

  // TODO: linked_account_id / linked_target_account_id / linked_card_id 컬럼이
  // 아직 DB에 없는 환경에서는 PostgREST가 "column not found" 에러(42703)를 반환함.
  // 마이그레이션 적용 전까지는 해당 필드를 제거하고 재시도.
  while (result.error?.code === '42703' || result.error?.code === 'PGRST204') {
    const missingCol = (['linked_account_id', 'linked_target_account_id', 'linked_card_id'] as const)
      .find(col => col in payload && result.error?.message?.includes(col))
    if (!missingCol) break
    delete payload[missingCol]
    result = await supabase.from('fixed_costs').insert(payload).select().single()
  }

  return result
}

export async function editFixedCost(id: string, updates: Partial<{
  name: string; amount: number; due_day: number | null;
  linked_account_id: string | null; linked_target_account_id: string | null; linked_card_id: string | null;
}>) {
  return supabase.from('fixed_costs').update(updates).eq('id', id)
}

export async function deleteFixedCost(id: string) {
  return supabase.from('fixed_costs').delete().eq('id', id)
}
