import { supabase } from '@/lib/supabase'
import type { FixedCost, Card } from '@spenlog/types'

export interface AccountUpdate {
  id: string
  balance: number
}

export async function getPaidIds(userId: string, month: string): Promise<{ fixedCostIds: Set<string>; cardIds: Set<string> }> {
  const { data } = await supabase
    .from('savings_payments')
    .select('fixed_cost_id, card_id')
    .eq('user_id', userId)
    .eq('year_month', month)
    .eq('is_paid', true)

  const fixedCostIds = new Set<string>()
  const cardIds = new Set<string>()
  ;(data ?? []).forEach((p: { fixed_cost_id: string | null; card_id: string | null }) => {
    if (p.fixed_cost_id) fixedCostIds.add(p.fixed_cost_id)
    if (p.card_id) cardIds.add(p.card_id)
  })
  return { fixedCostIds, cardIds }
}

export async function recordFixedCostPayment(userId: string, fc: FixedCost, month: string): Promise<{ accountUpdates: AccountUpdate[] }> {
  const today = new Date().toISOString().split('T')[0]

  await supabase.from('savings_payments').upsert({
    user_id: userId,
    fixed_cost_id: fc.id,
    year_month: month,
    is_paid: true,
    paid_amount: fc.amount,
  }, { onConflict: 'user_id,year_month,fixed_cost_id' })

  const isTransfer = fc.kind === '고정저축'
  let paymentMethod: string | null = null
  if (fc.linked_card_id) {
    const { data: card } = await supabase.from('cards').select('name').eq('id', fc.linked_card_id).single()
    paymentMethod = card?.name ?? null
  }

  await supabase.from('expenses').insert({
    user_id: userId,
    name: fc.name,
    amount: fc.amount,
    category: '고정비',
    date: today,
    payment_method: paymentMethod,
    type: isTransfer ? 'savings' : 'expense',
    source: 'routine',
    memo: isTransfer ? '고정 저축 이체' : '고정 지출 처리',
  })

  const accountUpdates: AccountUpdate[] = []
  if (fc.linked_account_id) {
    const { data: srcAcc } = await supabase.from('accounts').select('balance').eq('id', fc.linked_account_id).single()
    if (srcAcc != null) {
      const newBalance = (srcAcc.balance ?? 0) - fc.amount
      await supabase.from('accounts').update({ balance: newBalance }).eq('id', fc.linked_account_id)
      accountUpdates.push({ id: fc.linked_account_id, balance: newBalance })
    }
  }
  if (isTransfer && fc.linked_target_account_id) {
    const { data: tgtAcc } = await supabase.from('accounts').select('balance').eq('id', fc.linked_target_account_id).single()
    if (tgtAcc != null) {
      const newBalance = (tgtAcc.balance ?? 0) + fc.amount
      await supabase.from('accounts').update({ balance: newBalance }).eq('id', fc.linked_target_account_id)
      accountUpdates.push({ id: fc.linked_target_account_id, balance: newBalance })
    }
  }

  return { accountUpdates }
}

export async function recordCardPayment(
  userId: string, card: Card, month: string, amount: number, date: string, memo: string | null
): Promise<{ accountUpdates: AccountUpdate[] }> {
  await supabase.from('expenses').insert({
    user_id: userId,
    type: 'expense',
    category: '고정비',
    name: `${card.name} 카드 대금`,
    amount,
    date,
    payment_method: card.name,
    memo: memo || null,
    source: 'manual',
  })

  const accountUpdates: AccountUpdate[] = []
  const linkedAccountId = card.linked_account_id ?? card.linked_account
  if (linkedAccountId) {
    const { data: acc } = await supabase.from('accounts').select('balance').eq('id', linkedAccountId).single()
    if (acc != null) {
      const newBalance = (acc.balance ?? 0) - amount
      await supabase.from('accounts').update({ balance: newBalance }).eq('id', linkedAccountId)
      accountUpdates.push({ id: linkedAccountId, balance: newBalance })
    }
  }

  await supabase.from('savings_payments').upsert({
    user_id: userId,
    fixed_cost_id: null,
    card_id: card.id,
    year_month: month,
    amount,
    is_paid: true,
    paid_at: new Date().toISOString(),
  }, { onConflict: 'user_id,year_month,card_id' })

  return { accountUpdates }
}
