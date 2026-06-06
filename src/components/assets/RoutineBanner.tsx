'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import dayjs from 'dayjs'

interface FixedCost {
  id: string; name: string; amount: number; kind: string; due_day?: number
  linked_account_id?: string | null
  linked_target_account_id?: string | null
}

interface AccountUpdate { id: string; balance: number }

interface Props {
  userId: string
  fixedCosts: FixedCost[]
  thisMonth: string
  onAccountsChange?: (updates: AccountUpdate[]) => void
}

export default function RoutineBanner({ userId, fixedCosts, thisMonth, onAccountsChange }: Props) {
  const supabase = createClient()
  const [payments, setPayments] = useState<Record<string, boolean>>({})
  const [loadingPayments, setLoadingPayments] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(fixedCosts.length > 0)
  const [toast, setToast] = useState('')

  useEffect(() => {
    async function loadPayments() {
      setLoadingPayments(true)
      const { data } = await supabase
        .from('savings_payments')
        .select('fixed_cost_id, is_paid')
        .eq('user_id', userId)
        .eq('year_month', thisMonth)
      if (data) {
        const map: Record<string, boolean> = {}
        data.forEach(p => { map[p.fixed_cost_id] = p.is_paid })
        setPayments(map)
      }
      setLoadingPayments(false)
    }
    loadPayments()
  }, [userId, thisMonth])

  const pending = fixedCosts.filter(f => !payments[f.id])
  if (fixedCosts.length === 0) return (
    <div style={{
      background: 'var(--color-primary-light)', border: '1.5px dashed var(--color-primary-light)',
      borderRadius: 16, padding: '14px 16px', marginBottom: 12,
    }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary-mid)', marginBottom: 2 }}>📋 루틴 관리</p>
      <p style={{ fontSize: 11, color: 'var(--color-primary-mid)' }}>고정비·저축을 추가하면 매달 한 번에 기록할 수 있어요</p>
    </div>
  )
  if (loadingPayments) return (
    <div style={{ background: 'var(--color-primary-light)', borderRadius: 16, padding: '14px 16px', marginBottom: 12, opacity: 0.6 }}>
      <p style={{ fontSize: 13, color: 'var(--color-primary-mid)' }}>이번 달 처리할 항목 확인 중...</p>
    </div>
  )

  const allDone = pending.length === 0

  async function recordPayment(fc: FixedCost) {
    setProcessing(fc.id)
    try {
      const today = new Date().toISOString().split('T')[0]

      // 1. savings_payments 기록
      await supabase.from('savings_payments').upsert({
        user_id: userId, fixed_cost_id: fc.id,
        year_month: thisMonth, is_paid: true, paid_amount: fc.amount,
      })

      // 2. expenses 테이블에 내역 저장 (내역 탭 반영)
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

      // 3. 연결 계좌 잔액 변동 + 즉각 UI 동기화
      const accountUpdates: AccountUpdate[] = []
      if (fc.linked_account_id) {
        const { data: srcAcc } = await supabase
          .from('accounts').select('balance').eq('id', fc.linked_account_id).single()
        if (srcAcc != null) {
          const newBalance = (srcAcc.balance ?? 0) - fc.amount
          await supabase.from('accounts').update({ balance: newBalance }).eq('id', fc.linked_account_id)
          accountUpdates.push({ id: fc.linked_account_id, balance: newBalance })
        }
      }
      if (fc.kind === '고정저축' && fc.linked_target_account_id) {
        const { data: tgtAcc } = await supabase
          .from('accounts').select('balance').eq('id', fc.linked_target_account_id).single()
        if (tgtAcc != null) {
          const newBalance = (tgtAcc.balance ?? 0) + fc.amount
          await supabase.from('accounts').update({ balance: newBalance }).eq('id', fc.linked_target_account_id)
          accountUpdates.push({ id: fc.linked_target_account_id, balance: newBalance })
        }
      }
      if (accountUpdates.length > 0) onAccountsChange?.(accountUpdates)

      setPayments(p => ({ ...p, [fc.id]: true }))
      setToast(fc.name + ' 기록 완료 ✓')
      setTimeout(() => setToast(''), 2000)
    } finally {
      setProcessing(null)
    }
  }

  const today = parseInt(dayjs().format('D'))

  return (
    <>
      {toast && (
        <div style={{
          position: 'fixed' as const, top: 16, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, background: '#10B981', color: '#fff',
          padding: '8px 16px', borderRadius: 12, fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>{toast}</div>
      )}
      <div style={{
        background: allDone
          ? 'linear-gradient(135deg, #f0fdf4, #fff)'
          : 'linear-gradient(135deg, var(--color-primary-light), #fff)',
        border: '1.5px solid ' + (allDone ? '#bbf7d0' : 'var(--color-primary-light)'),
        borderRadius: 16, padding: '14px 16px', marginBottom: 12,
      }}>
        <button onClick={() => setExpanded(e => !e)} style={{
          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>{allDone ? '🎉' : '📋'}</span>
            <div style={{ textAlign: 'left' as const }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: allDone ? '#059669' : 'var(--color-accent)' }}>
                {allDone
                  ? '이번 달 모두 완료!'
                  : '이번 달 처리할 항목 ' + pending.length + '건'}
              </p>
              <p style={{ fontSize: 11, color: allDone ? '#6ee7b7' : 'var(--color-primary-mid)' }}>
                {expanded ? '탭해서 접기' : '탭해서 확인하기'}
              </p>
            </div>
          </div>
          <span style={{
            fontSize: 14, color: allDone ? '#6ee7b7' : 'var(--color-primary-mid)',
            transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s',
          }}>▼</span>
        </button>

        {expanded && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
            {fixedCosts.map(fc => {
              const paid = payments[fc.id]
              const overdue = fc.due_day && today > fc.due_day
              return (
                <div key={fc.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 12px', background: paid ? '#f0fdf4' : '#fff',
                  borderRadius: 10, border: '1px solid ' + (paid ? '#bbf7d0' : '#f0f0f0'),
                }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#1f2937' }}>
                      {fc.name}
                      {overdue && !paid && (
                        <span style={{ fontSize: 10, color: '#ef4444', marginLeft: 4 }}>
                          ⚠️ 출금일 지남
                        </span>
                      )}
                    </p>
                    <p style={{ fontSize: 11, color: '#9ca3af' }}>
                      {fc.amount.toLocaleString()}원 {fc.due_day ? '매월 ' + fc.due_day + '일' : ''}
                    </p>
                  </div>
                  {paid ? (
                    <span style={{ fontSize: 12, color: '#10B981', fontWeight: 700 }}>✓ 완료</span>
                  ) : (
                    <button
                      onClick={() => recordPayment(fc)}
                      disabled={processing === fc.id}
                      style={{
                        padding: '6px 12px', borderRadius: 8, border: 'none',
                        background: 'var(--color-primary)', color: '#fff',
                        fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      {processing === fc.id ? '...' : '기록하기'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
