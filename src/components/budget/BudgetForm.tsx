'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { CATEGORIES } from '@/lib/themes'
import { Budget } from '@/types'

interface Expense { category: string; amount: number }
interface Props {
  userId: string
  initialBudgets: Budget[]
  expenses: Expense[]
  thisMonth: string
  income: number
}

// AI 추천 비율 (저축 목표 기준)
const PRESETS = {
  보수: { label: '보수형', desc: '40% 저축 목표', pct: 0.60,
    dist: { 생활비: 0.35, 활동비: 0.20, 고정비: 0.25, 친목비: 0.10, 예비비: 0.10 } },
  보통: { label: '보통형', desc: '25% 저축 목표', pct: 0.75,
    dist: { 생활비: 0.30, 활동비: 0.25, 고정비: 0.25, 친목비: 0.12, 예비비: 0.08 } },
  여유: { label: '여유형', desc: '15% 저축 목표', pct: 0.85,
    dist: { 생활비: 0.28, 활동비: 0.28, 고정비: 0.22, 친목비: 0.14, 예비비: 0.08 } },
} as const

export default function BudgetForm({ userId, initialBudgets, expenses, thisMonth, income }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [tab, setTab] = useState<'manual' | 'ai'>('manual')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<keyof typeof PRESETS | null>(null)
  const [amounts, setAmounts] = useState<Record<string, string>>(
    Object.fromEntries(CATEGORIES.map(cat => [
      cat,
      initialBudgets.find(b => b.category === cat)?.amount.toString() || ''
    ]))
  )

  function handleChange(cat: string, value: string) {
    setAmounts(prev => ({ ...prev, [cat]: value.replace(/[^0-9]/g, '') }))
  }

  function applyPreset(preset: keyof typeof PRESETS) {
    setSelectedPreset(preset)
    if (!income) return
    const p = PRESETS[preset]
    const total = Math.round(income * p.pct)
    const newAmounts = Object.fromEntries(
      CATEGORIES.map(cat => [cat, Math.round(total * (p.dist as any)[cat]).toString()])
    )
    setAmounts(newAmounts)
  }

  async function handleSave() {
    setLoading(true)
    const upsertData = CATEGORIES.map(cat => ({
      user_id: userId,
      category: cat,
      amount: parseInt(amounts[cat] || '0'),
      month: thisMonth,
    }))
    await supabase.from('budgets').upsert(upsertData, { onConflict: 'user_id,category,month' })
    setLoading(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    router.refresh()
  }

  const totalBudget = CATEGORIES.reduce((s, c) => s + (parseInt(amounts[c] || '0') || 0), 0)
  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0)
  const overallPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0

  return (
    <div className="space-y-4">
      {/* 탭 */}
      <div style={{ display: 'flex', background: '#F0EAEC', borderRadius: '16px', padding: '4px', gap: '4px' }}>
        {(['manual', 'ai'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '8px', borderRadius: '12px', fontSize: '13px', fontWeight: '600',
            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            background: tab === t ? 'var(--color-primary)' : 'transparent',
            color: tab === t ? '#fff' : '#B8A8AC',
          }}>
            {t === 'manual' ? '✏️ 직접 입력' : '✨ AI 추천'}
          </button>
        ))}
      </div>

      {/* AI 추천 탭 */}
      {tab === 'ai' && (
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <p className="text-xs text-gray-400 mb-3">
            {income > 0 ? `월 수입 ${income.toLocaleString()}원 기준` : '설정에서 월 수입을 입력하면 더 정확해요'}
          </p>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map(key => {
              const p = PRESETS[key]
              const selected = selectedPreset === key
              const total = income ? Math.round(income * p.pct) : 0
              return (
                <button key={key} onClick={() => applyPreset(key)} style={{
                  padding: '12px 8px', borderRadius: '12px',
                  border: selected ? '2px solid var(--color-primary)' : '2px solid #f0f0f0',
                  background: selected ? 'var(--color-primary-light)' : '#fafafa',
                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' as const,
                }}>
                  <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--color-primary)', marginBottom: '2px' }}>{p.label}</p>
                  <p style={{ fontSize: '10px', color: '#aaa' }}>{p.desc}</p>
                  {income > 0 && <p style={{ fontSize: '11px', fontWeight: '600', color: '#555', marginTop: '4px' }}>{total.toLocaleString()}원</p>}
                </button>
              )
            })}
          </div>
          {selectedPreset && income > 0 && (
            <div className="space-y-2">
              {CATEGORIES.map(cat => (
                <div key={cat} className="flex justify-between text-xs py-1">
                  <span className="text-gray-600">{cat}</span>
                  <span className="font-semibold" style={{ color: 'var(--color-primary)' }}>
                    {parseInt(amounts[cat] || '0').toLocaleString()}원
                  </span>
                </div>
              ))}
            </div>
          )}
          {!income && (
            <p className="text-xs text-gray-400 text-center py-4">
              <a href="/settings" style={{ color: 'var(--color-primary)' }}>설정</a>에서 월 수입을 먼저 입력해 주세요.
            </p>
          )}
        </div>
      )}

      {/* 전체 요약 */}
      {totalBudget > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <div className="flex justify-between text-xs mb-2">
            <span className="text-gray-500 font-medium">전체 예산 달성률</span>
            <span className={`font-bold ${overallPct > 100 ? 'text-rose-500' : overallPct >= 80 ? 'text-amber-500' : 'text-emerald-600'}`}>
              {overallPct}%
            </span>
          </div>
          <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{
              width: `${Math.min(overallPct, 100)}%`,
              background: overallPct > 100 ? '#EF4444' : overallPct >= 80 ? '#F59E0B' : 'var(--color-primary)',
            }} />
          </div>
          <div className="flex justify-between text-[11px] text-gray-400 mt-1.5">
            <span>지출 {totalSpent.toLocaleString()}원</span>
            <span>예산 {totalBudget.toLocaleString()}원</span>
          </div>
        </div>
      )}

      {/* 수동 입력 */}
      <div className="space-y-3">
        {CATEGORIES.map((cat) => {
          const spent = expenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0)
          const budget = parseInt(amounts[cat] || '0') || 0
          const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0
          const over = spent > budget && budget > 0

          return (
            <div key={cat} className="bg-white rounded-2xl p-4 border border-gray-100">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">{cat}</span>
                <div className="flex items-center gap-1">
                  <span className="text-gray-400 text-sm">₩</span>
                  <input
                    type="text" inputMode="numeric"
                    className="w-28 text-right text-sm font-semibold outline-none text-gray-800 placeholder:text-gray-200"
                    placeholder="0"
                    value={amounts[cat]}
                    onChange={(e) => handleChange(cat, e.target.value)}
                  />
                </div>
              </div>
              {budget > 0 && (
                <div>
                  <div className="bg-gray-100 rounded-full h-1.5 overflow-hidden mb-1">
                    <div className="h-full rounded-full" style={{
                      width: `${Math.min(pct, 100)}%`,
                      background: over ? '#EF4444' : pct >= 80 ? '#F59E0B' : 'var(--color-primary)',
                    }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400">
                    <span className={over ? 'text-rose-400 font-medium' : ''}>
                      {spent > 0 ? `지출 ${spent.toLocaleString()}원` : '지출 없음'}
                    </span>
                    <span>{pct}%{over ? ' 초과!' : ''}</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <button onClick={handleSave} disabled={loading} style={{
        width: '100%', padding: '14px', borderRadius: '16px',
        background: saved ? '#2E7D52' : 'var(--color-primary)',
        color: '#fff', fontSize: '14px', fontWeight: '600', border: 'none',
        cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 0.3s', fontFamily: 'inherit',
      }}>
        {loading ? '저장 중...' : saved ? '✓ 저장됨' : '예산 저장하기'}
      </button>
    </div>
  )
}

    </div>
  )
}
}
