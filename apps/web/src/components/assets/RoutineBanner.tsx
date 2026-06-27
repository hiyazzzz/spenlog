'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { recordFixedCostPayment } from '@/lib/routine'
import dayjs from 'dayjs'

interface FixedCost {
  id: string; name: string; amount: number; kind: string; due_day?: number | null
  linked_account_id?: string | null
  linked_target_account_id?: string | null
  linked_card_id?: string | null
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
  const [paymentDates, setPaymentDates] = useState<Record<string, string>>({})
  const [loadingPayments, setLoadingPayments] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    async function loadPayments() {
      setLoadingPayments(true)
      const nextMonth = thisMonth >= '2026-12'
        ? String(parseInt(thisMonth.slice(0, 4)) + 1) + '-01'
        : thisMonth.slice(0, 5) + String(parseInt(thisMonth.slice(5)) + 1).padStart(2, '0')

      // expenses 테이블 기준으로 이번 달 루틴 기록 여부 확인
      // (savings_payments upsert가 불안정한 경우에도 expenses는 항상 생성됨)
      const { data: expData } = await supabase
        .from('expenses')
        .select('name, date')
        .eq('user_id', userId)
        .eq('source', 'routine')
        .gte('date', `${thisMonth}-01`)
        .lt('date', `${nextMonth}-01`)

      const paidMap: Record<string, string> = {}
      ;(expData ?? []).forEach(e => { paidMap[e.name] = e.date })
      const map: Record<string, boolean> = {}
      const dateMap: Record<string, string> = {}
      fixedCosts.forEach(fc => {
        if (paidMap[fc.name]) { map[fc.id] = true; dateMap[fc.id] = paidMap[fc.name] }
      })
      setPayments(map)
      setPaymentDates(dateMap)
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
      <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-primary-mid)', marginBottom: 2 }}>이번 달 정기 기록</p>
      <p style={{ fontSize: 12, color: 'var(--color-primary-mid)' }}>고정비·저축을 추가하면 매달 한 번에 기록할 수 있어요</p>
    </div>
  )
  if (loadingPayments) return (
    <div style={{ background: 'var(--color-primary-light)', borderRadius: 16, padding: '14px 16px', marginBottom: 12, opacity: 0.6 }}>
      <p style={{ fontSize: 13, color: 'var(--color-primary-mid)' }}>이번 달 처리할 항목 확인 중...</p>
    </div>
  )

  const allDone = pending.length === 0
  const doneCount = fixedCosts.length - pending.length

  // 정렬: 미완료 → 출금일 오름차순, 완료 → 출금일 오름차순 (하단)
  const sortedItems = [
    ...fixedCosts.filter(f => !payments[f.id]).sort((a, b) => (a.due_day ?? 99) - (b.due_day ?? 99)),
    ...fixedCosts.filter(f => payments[f.id]).sort((a, b) => (a.due_day ?? 99) - (b.due_day ?? 99)),
  ]

  async function recordPayment(fc: FixedCost) {
    setProcessing(fc.id)
    try {
      const { accountUpdates } = await recordFixedCostPayment(supabase, userId, {
        id: fc.id, name: fc.name, amount: fc.amount,
        kind: fc.kind as '고정지출' | '고정저축',
        due_day: fc.due_day ?? null,
        linked_account_id: fc.linked_account_id,
        linked_target_account_id: fc.linked_target_account_id,
        linked_card_id: fc.linked_card_id,
      }, thisMonth)
      if (accountUpdates.length > 0) onAccountsChange?.(accountUpdates)

      const today = new Date(Date.now() + 9*60*60*1000).toISOString().split('T')[0]
      setPayments(p => ({ ...p, [fc.id]: true }))
      setPaymentDates(d => ({ ...d, [fc.id]: today }))
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
                {allDone ? '이번 달 모두 완료!' : '이번 달 정기 기록'}
              </p>
              <p style={{ fontSize: 11, color: allDone ? '#6ee7b7' : 'var(--color-primary-mid)' }}>
                {doneCount}/{fixedCosts.length}건 완료 · {expanded ? '접기' : '펼치기'}
              </p>
            </div>
          </div>
          <span style={{
            fontSize: 14, color: allDone ? '#6ee7b7' : 'var(--color-primary-mid)',
            transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s',
          }}>▼</span>
        </button>

        {expanded && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
            {/* 전체 기록하기 버튼 (미완료 항목이 2개 이상일 때만) */}
            {pending.length >= 2 && (
              <button
                onClick={async () => {
                  for (const fc of pending) {
                    if (processing) continue
                    await recordPayment(fc)
                  }
                }}
                disabled={!!processing}
                style={{
                  width: '100%', padding: '9px 0', borderRadius: 10, border: 'none',
                  background: 'var(--color-primary)', color: '#fff',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  marginBottom: 4, opacity: processing ? 0.6 : 1,
                }}
              >
                {processing ? '기록 중...' : `전체 기록하기 (${pending.length}건)`}
              </button>
            )}
            {sortedItems.map(fc => {
              const paid = payments[fc.id]
              const paidDate = paymentDates[fc.id]
              const overdue = fc.due_day && today > fc.due_day
              return (
                <div key={fc.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 12px',
                  background: paid ? 'rgba(16,185,129,0.06)' : '#fff',
                  borderRadius: 10,
                  border: '1px solid ' + (paid ? '#bbf7d0' : '#f0f0f0'),
                  opacity: paid ? 0.85 : 1,
                  transition: 'all 0.2s',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/* 체크 아이콘 */}
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                      background: paid ? '#10B981' : 'transparent',
                      border: paid ? 'none' : '2px solid #d1d5db',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {paid && <span style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}>✓</span>}
                    </div>
                    <div>
                      <p style={{
                        fontSize: 13, fontWeight: 600,
                        color: paid ? '#6b7280' : '#1f2937',
                        textDecoration: paid ? 'line-through' : 'none',
                      }}>
                        {fc.name}
                        {overdue && !paid && (
                          <span style={{ fontSize: 10, color: '#ef4444', marginLeft: 4 }}>⚠️ 출금일 지남</span>
                        )}
                      </p>
                      <p style={{ fontSize: 11, color: '#9ca3af' }}>
                        {fc.amount.toLocaleString()}원
                        {paid && paidDate
                          ? <span style={{ color: '#10B981', marginLeft: 4 }}>{paidDate.slice(5).replace('-', '/')} 기록됨</span>
                          : fc.due_day ? <span style={{ marginLeft: 4 }}>매월 {fc.due_day}일</span> : null
                        }
                      </p>
                    </div>
                  </div>
                  {!paid && (
                    <button
                      onClick={() => recordPayment(fc)}
                      disabled={processing === fc.id}
                      style={{
                        padding: '6px 12px', borderRadius: 8, border: 'none',
                        background: 'var(--color-primary)', color: '#fff',
                        fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                        flexShrink: 0,
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
