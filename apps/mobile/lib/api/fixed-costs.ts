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

  const [{ data: fixedCosts, error: fcErr }, { data: appliedExpenses }, { data: accounts }, { data: cards }] = await Promise.all([
    supabase.from('fixed_costs').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
    supabase.from('expenses').select('name').eq('user_id', userId)
      .gte('date', `${thisMonth}-01`).eq('category', '고정비'),
    supabase.from('accounts').select('*').eq('user_id', userId),
    supabase.from('cards').select('*').eq('user_id', userId),
  ])

  if (fcErr) console.warn('[getFixedCostsData] fixed_costs fetch error:', fcErr.code, fcErr.message)

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
  type: string; kind: '\uace0\uc815\uc9c0\ucd9c' | '\uace0\uc815\uc800\ucd95'
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

  console.log('[addFixedCost] INSERT payload:', JSON.stringify(payload))
  let result = await supabase.from('fixed_costs').insert(payload).select().single()
  console.log('[addFixedCost] result data:', result.data, 'error:', result.error?.code, result.error?.message)

  // linked_* \ucee8\ub7fc\uc774 DB\uc5d0 \uc5c6\ub294 \ud658\uacbd(42703/PGRST204)\uc5d0\uc11c \uc7ac\uc2dc\ub3c4
  while (result.error?.code === '42703' || result.error?.code === 'PGRST204') {
    const missingCol = (['linked_account_id', 'linked_target_account_id', 'linked_card_id'] as const)
      .find(col => col in payload && result.error?.message?.includes(col))
    if (!missingCol) break
    console.log('[addFixedCost] retrying without', missingCol)
    delete payload[missingCol]
    result = await supabase.from('fixed_costs').insert(payload).select().single()
    console.log('[addFixedCost] retry result data:', result.data, 'error:', result.error?.code, result.error?.message)
  }

  if (result.error) {
    console.error('[addFixedCost] FINAL ERROR:', result.error.code, result.error.message, result.error.details)
  } else {
    console.log('[addFixedCost] SUCCESS, inserted id:', result.data?.id)
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
