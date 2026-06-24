'use client'
import { useState } from 'react'
import { TEXTS } from '@/config/texts'
import { createClient } from '@/lib/supabase/client'
import { recordFixedCostPayment, getPaidIds } from '@/lib/routine'
import { useRouter } from 'next/navigation'
import type { FixedCost } from '@spenlog/types'

interface Props {
  fixedCosts: FixedCost[]
  userId: string
  appliedNames: string[]
  thisMonth: string
}

export default function ApplyFixedCosts({ fixedCosts, userId, appliedNames, thisMonth }: Props) {
  const [applying, setApplying] = useState(false)
  const [done, setDone] = useState(false)
  const router = useRouter()

  const notApplied = fixedCosts.filter(f => !appliedNames.includes(f.name))

  if (fixedCosts.length === 0) return null

  async function handleApply() {
    if (notApplied.length === 0) return
    setApplying(true)
    const supabase = createClient()

    // savings_payments에서 이미 루틴 완료 처리된 항목 제외 (중복 방지)
    const { fixedCostIds: paidIds } = await getPaidIds(supabase, userId, thisMonth)
    const toInsert = notApplied.filter(f => !paidIds.has(f.id))

    if (toInsert.length === 0) {
      setApplying(false)
      setDone(true)
      return
    }

    for (const f of toInsert) {
      await recordFixedCostPayment(supabase, userId, {
        id: f.id, name: f.name, amount: f.amount,
        kind: f.kind, due_day: f.due_day, linked_account_id: f.linked_account_id,
        linked_target_account_id: f.linked_target_account_id, linked_card_id: f.linked_card_id,
      }, thisMonth)
    }
    setApplying(false)
    setDone(true)
    router.refresh()
  }

  if (done || notApplied.length === 0) {
    return (
      <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 mb-4 flex items-center gap-3">
        <span className="text-emerald-500 text-lg">✓</span>
        <p className="text-sm text-emerald-700 font-medium">
          {TEXTS.fixed.apply.doneTitle(fixedCosts.length)}
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 mb-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm font-semibold text-gray-800">{TEXTS.fixed.apply.pendingTitle}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {TEXTS.fixed.apply.pendingDesc(notApplied.length, notApplied.reduce((s, f) => s + f.amount, 0))}
          </p>
        </div>
        <button onClick={handleApply} disabled={applying} style={{
          padding: '8px 16px', borderRadius: '12px',
          background: applying ? '#C4A0A8' : 'var(--color-primary)',
          color: '#fff', fontSize: '13px', fontWeight: '600',
          border: 'none', cursor: applying ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
        }}>
          {applying ? '반영 중...' : '지출에 반영'}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {notApplied.map(f => (
          <span key={f.id} className="text-[11px] bg-gray-50 text-gray-500 px-2 py-1 rounded-lg border border-gray-100">
            {f.name} {f.amount.toLocaleString()}원
          </span>
        ))}
      </div>
    </div>
  )
}
