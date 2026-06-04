'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import dayjs from 'dayjs'

interface FixedCost {
  id: string; name: string; amount: number; kind: string; due_day?: number
}

interface Props {
  userId: string
  fixedCosts: FixedCost[]
  thisMonth: string
}

export default function RoutineBanner({ userId, fixedCosts, thisMonth }: Props) {
  const supabase = createClient()
  const [payments, setPayments] = useState<Record<string, boolean>>({})
  const [processing, setProcessing] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    async function loadPayments() {
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
    }
    loadPayments()
  }, [userId, thisMonth])

  const pending = fixedCosts.filter(f => !payments[f.id])
  if (pending.length === 0) return null

  async function recordPayment(fc: FixedCost) {
    setProcessing(fc.id)
    await supabase.from('savings_payments').upsert({
      user_id: userId,
      fixed_cost_id: fc.id,
      year_month: thisMonth,
      is_paid: true,
      paid_amount: fc.amount,
    })
    setPayments(p => ({ ...p, [fc.id]: true }))
    setProcessing(null)
    setToast(`${fc.name} 기록 완료 ✓`)
    setTimeout(() => setToast(''), 2000)
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
        background: 'linear-gradient(135deg, var(--color-primary-light), #fff)',
        border: '1.5px solid var(--color-primary-light)',
        borderRadius: 16, padding: '14px 16px', marginBottom: 12,
      }}>
        <button onClick={() => setExpanded(e => !e)} style={{
          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>📋</span>
            <div style={{ textAlign: 'left' as const }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-accent)' }}>
                이번 달 처리할 항목 {pending.length}건
              </p>
              <p style={{ fontSize: 11, color: 'var(--color-primary-mid)' }}>탭해서 확인하기</p>
            </div>
          </div>
          <span style={{ fontSize: 14, color: 'var(--color-primary-mid)', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
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
                      {overdue && !paid && <span style={{ fontSize: 10, color: '#ef4444', marginLeft: 4 }}>⚠️ 출금일 지남</span>}
                    </p>
                    <p style={{ fontSize: 11, color: '#9ca3af' }}>
                      ₩{fc.amount.toLocaleString()} · {fc.due_day ? `매월 ${fc.due_day}일` : ''}
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
