import type { SupabaseClient } from '@supabase/supabase-js'
import type { FixedCost } from '@spenlog/types'

export interface AccountUpdate {
  id: string
  balance: number
}

/**
 * 고정비/고정저축 항목을 이번 달 처리 완료로 기록.
 * - savings_payments upsert (user_id, year_month, fixed_cost_id 기준 중복 방지)
 * - expenses 내역 추가
 * - 연결 계좌 잔액 변동
 *
 * RoutineBanner(자산 탭), ApplyFixedCosts(고정비 탭), cron(/api/routine/execute) 공용 로직.
 */
export async function recordFixedCostPayment(
  supabase: SupabaseClient,
  userId: string,
  fc: Pick<FixedCost, 'id' | 'name' | 'amount' | 'kind' | 'linked_account_id' | 'linked_target_account_id'>,
  month: string,
): Promise<{ accountUpdates: AccountUpdate[] }> {
  const today = new Date().toISOString().split('T')[0]

  await supabase.from('savings_payments').upsert({
    user_id: userId,
    fixed_cost_id: fc.id,
    year_month: month,
    is_paid: true,
    paid_amount: fc.amount,
    paid_at: new Date().toISOString(),
  }, { onConflict: 'user_id,year_month,fixed_cost_id' })

  const isTransfer = fc.kind === '고정저축'
  await supabase.from('expenses').insert({
    user_id: userId,
    name: fc.name,
    amount: fc.amount,
    category: '고정비',
    date: today,
    payment_method: null,
    type: isTransfer ? 'transfer' : 'expense',
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

/**
 * 이번 달 이미 처리(is_paid=true) 완료된 fixed_cost_id / card_id 목록 조회.
 */
export async function getPaidIds(
  supabase: SupabaseClient,
  userId: string,
  month: string,
): Promise<{ fixedCostIds: Set<string>; cardIds: Set<string> }> {
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
