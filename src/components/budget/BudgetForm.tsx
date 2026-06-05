'use client'
import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { CATEGORIES } from '@/lib/themes'
import { Budget } from '@/types'

interface Expense { category: string; amount: number }
interface RecentExpense { category: string; amount: number; month: string }
interface Props {
  userId: string
  initialBudgets: Budget[]
  expenses: Expense[]
  thisMonth: string
  income: number
  fixedSavings?: number
  recentExpenses?: RecentExpense[]
}

// 저축 플랜 — 감각적 네이밍
const PRESETS = [
  {
    key: '알뜰',
    label: '💰 알뜰하게',
    desc: '수입의 40% 저축',
    savingRate: 0.40,
    dist: { 생활비: 0.35, 활동비: 0.20, 고정비: 0.25, 친목비: 0.10, 예비비: 0.10 },
  },
  {
    key: '균형',
    label: '⚖️ 균형있게',
    desc: '수입의 25% 저축',
    savingRate: 0.25,
    dist: { 생활비: 0.30, 활동비: 0.25, 고정비: 0.25, 친목비: 0.12, 예비비: 0.08 },
  },
  {
    key: '여유',
    label: '🌈 여유있게',
    desc: '수입의 15% 저축',
    savingRate: 0.15,
    dist: { 생활비: 0.28, 활동비: 0.28, 고정비: 0.22, 친목비: 0.14, 예비비: 0.08 },
  },
] as const

// DB에 저장된 값을 기준으로 초기 amounts 생성
function getInitialAmounts(initialBudgets: Budget[]) {
  return Object.fromEntries(CATEGORIES.map(cat => [
    cat,
    initialBudgets.find(b => b.category === cat)?.amount.toString() || ''
  ]))
}

export default function BudgetForm({ userId, initialBudgets, expenses, thisMonth, income, fixedSavings = 0, recentExpenses = [] }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [tab, setTab] = useState<'manual' | 'ai'>('manual')
  const [loading, setLoading] = useState(false)
  const [savedOk, setSavedOk] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiReason, setAiReason] = useState<string | null>(null)
  const [aiToast, setAiToast] = useState<string | null>(null)

  // savedAmounts: DB 저장된 값 (탭 전환해도 유지)
  const savedAmounts = useMemo(() => getInitialAmounts(initialBudgets), [initialBudgets])

  // amounts: 현재 입력 필드값 (manual 탭 전용)
  const [amounts, setAmounts] = useState<Record<string, string>>(savedAmounts)

  // AI 추천으로 계산된 임시 amounts (저장 전까지는 manual에 반영 안 함)
  const [aiAmounts, setAiAmounts] = useState<Record<string, string>>({})

  function handleTabChange(t: 'manual' | 'ai') {
    setTab(t)
    if (t === 'manual') {
      // 탭 전환 시 DB 저장값으로 리셋 (AI 추천값 버림)
      setAmounts(savedAmounts)
      setSelectedPreset(null)
    }
  }

  function handleChange(cat: string, value: string) {
    setAmounts(prev => ({ ...prev, [cat]: value.replace(/[^0-9]/g, '') }))
  }

  function applyPreset(preset: typeof PRESETS[number]) {
    setSelectedPreset(preset.key)
    if (!income) return

    // 저축 우선 로직:
    // 1) 목표 저축액 = income × savingRate
    // 2) 고정저축이 있으면 이미 확보된 저축 차감
    // 3) 추가 저축 필요액 = 목표 저축 - 고정저축
    // 4) 지출 예산 = income - 목표 저축액
    const targetSaving = Math.round(income * preset.savingRate)
    const additionalSaving = Math.max(0, targetSaving - fixedSavings)
    const spendBudget = income - targetSaving

    const newAmounts = Object.fromEntries(
      CATEGORIES.map(cat => [cat, Math.round(spendBudget * (preset.dist as any)[cat]).toString()])
    )
    setAiAmounts(newAmounts)

    // AI 탭에서 바로 manual amounts에도 반영 (저장 시 이 값으로)
    setAmounts(newAmounts)
  }

  async function handleAiRecommend() {
    if (!income) {
      setAiToast('자산 탭에서 월 수입을 먼저 입력해주세요')
      setTimeout(() => setAiToast(null), 3000)
      return
    }
    setAiLoading(true)
    setAiReason(null)
    try {
      const res = await fetch('/api/budget-recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          income,
          fixedSavings,
          recentExpenses,
          currentBudgets: initialBudgets.map(b => ({ category: b.category, amount: b.amount })),
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? 'API_ERROR')

      const newAmounts = Object.fromEntries(
        Object.entries(data.amounts as Record<string, number>).map(([k, v]) => [k, String(v)])
      )
      setAiAmounts(newAmounts)
      setAmounts(newAmounts)
      setSelectedPreset('ai-custom')
      setAiReason(data.reason ?? null)

      if (data.usedFallback) {
        setAiToast('AI 추천에 실패해 균형 플랜을 적용했어요')
        setTimeout(() => setAiToast(null), 3000)
      }
    } catch {
      const fallback = fallbackAmounts(income, fixedSavings)
      const newAmounts = Object.fromEntries(Object.entries(fallback).map(([k, v]) => [k, String(v)]))
      setAiAmounts(newAmounts)
      setAmounts(newAmounts)
      setSelectedPreset('ai-custom')
      setAiToast('AI 추천에 실패해 균형 플랜을 적용했어요')
      setTimeout(() => setAiToast(null), 3000)
    } finally {
      setAiLoading(false)
    }
  }

  function fallbackAmounts(inc: number, fixed: number): Record<string, number> {
    const spendBudget = inc - Math.round(inc * 0.25)
    const dist: Record<string, number> = { 생활비: 0.30, 활동비: 0.25, 고정비: 0.25, 친목비: 0.12, 예비비: 0.08 }
    return Object.fromEntries(CATEGORIES.map(cat => [cat, Math.round(spendBudget * dist[cat])]))
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
    setSavedOk(true)
    setTimeout(() => setSavedOk(false), 2000)
    router.refresh()
  }

  const displayAmounts = tab === 'ai' && selectedPreset ? aiAmounts : amounts
  const totalBudget = CATEGORIES.reduce((s, c) => s + (parseInt(displayAmounts[c] || '0') || 0), 0)
  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0)
  const overallPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0

  return (
    <div className="space-y-4">
      {/* 토스트 */}
      {aiToast && (
        <div style={{
          position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)',
          background: '#1f2937', color: '#fff', borderRadius: 12, padding: '10px 20px',
          fontSize: 13, zIndex: 9999, whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        }}>
          {aiToast}
        </div>
      )}

      {/* 탭 */}
      <div style={{ display: 'flex', background: '#F0EAEC', borderRadius: '16px', padding: '4px', gap: '4px' }}>
        {(['manual', 'ai'] as const).map(t => (
          <button key={t} onClick={() => handleTabChange(t)} style={{
            flex: 1, padding: '8px', borderRadius: '12px', fontSize: '13px', fontWeight: '600',
            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            background: tab === t ? 'var(--color-primary)' : 'transparent',
            color: tab === t ? '#fff' : '#B8A8AC',
          }}>
            {t === 'manual' ? '✏️ 직접 입력' : '✨ 스마트 추천'}
          </button>
        ))}
      </div>

      {/* AI 추천 탭 */}
      {tab === 'ai' && (
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          {income > 0 ? (
            <>
              <p className="text-xs text-gray-400 mb-1">
                월 수입 <span className="font-semibold text-gray-600">{income.toLocaleString()}원</span> 기준
              </p>
              {fixedSavings > 0 && (
                <p className="text-xs text-emerald-600 mb-3">
                  고정저축 {fixedSavings.toLocaleString()}원 반영됨
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-gray-400 mb-3">
              <a href="/assets" style={{ color: 'var(--color-primary)' }}>자산 탭</a>에서 월 수입을 입력하면 더 정확해요
            </p>
          )}

          {/* 플랜 카드 */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {PRESETS.map(preset => {
              const selected = selectedPreset === preset.key
              const targetSave = income ? Math.round(income * preset.savingRate) : 0
              const spendBudget = income ? income - targetSave : 0

              return (
                <button key={preset.key} onClick={() => applyPreset(preset)} style={{
                  padding: '12px 8px', borderRadius: '14px',
                  border: selected ? '2px solid var(--color-primary)' : '2px solid #f0f0f0',
                  background: selected ? 'var(--color-primary-light)' : '#fafafa',
                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' as const,
                }}>
                  <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--color-primary)', marginBottom: '2px' }}>
                    {preset.label}
                  </p>
                  <p style={{ fontSize: '10px', color: '#aaa', marginBottom: '4px' }}>{preset.desc}</p>
                  {income > 0 && (
                    <p style={{ fontSize: '11px', fontWeight: '600', color: '#555' }}>
                      지출 {spendBudget.toLocaleString()}원
                    </p>
                  )}
                </button>
              )
            })}
          </div>

          {/* AI 맞춤 추천 버튼 */}
          <button
            onClick={handleAiRecommend}
            disabled={aiLoading}
            style={{
              width: '100%', padding: '12px', borderRadius: '14px', marginBottom: '12px',
              border: selectedPreset === 'ai-custom' ? '2px solid var(--color-primary)' : '2px dashed #d1d5db',
              background: selectedPreset === 'ai-custom' ? 'var(--color-primary-light)' : '#fafafa',
              color: selectedPreset === 'ai-custom' ? 'var(--color-primary)' : '#6b7280',
              fontSize: '13px', fontWeight: '600', cursor: aiLoading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}
          >
            {aiLoading ? (
              <>
                <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span>
                내 소비 패턴 분석 중...
              </>
            ) : (
              <>✨ 내 소비패턴 기반 AI 맞춤 추천</>
            )}
          </button>

          {/* AI 추천 근거 */}
          {aiReason && selectedPreset === 'ai-custom' && (
            <div style={{
              background: 'rgba(107,30,46,0.06)', borderRadius: 12, padding: '10px 12px',
              marginBottom: 12, fontSize: 12, color: 'var(--color-accent)', lineHeight: 1.6,
            }}>
              💡 {aiReason}
            </div>
          )}

          {/* 저축 분석 */}
          {selectedPreset && income > 0 && (() => {
            const preset = PRESETS.find(p => p.key === selectedPreset)!
            const targetSave = Math.round(income * preset.savingRate)
            const addSave = Math.max(0, targetSave - fixedSavings)
            return (
              <div className="rounded-xl p-3 mb-3" style={{ background: 'rgba(16,185,129,0.08)' }}>
                <p className="text-xs font-semibold text-emerald-700 mb-2">💚 저축 플랜</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">목표 저축</span>
                    <span className="font-semibold text-emerald-600">{targetSave.toLocaleString()}원</span>
                  </div>
                  {fixedSavings > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">고정저축 (이미 확보)</span>
                      <span className="font-medium text-gray-600">{fixedSavings.toLocaleString()}원</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs border-t border-emerald-100 pt-1 mt-1">
                    <span className="text-gray-500">추가 저축 목표</span>
                    <span className="font-bold text-emerald-700">{addSave.toLocaleString()}원</span>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* 카테고리별 배분 */}
          {selectedPreset && income > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-gray-400 mb-2">📊 지출 예산 배분</p>
              {CATEGORIES.map(cat => (
                <div key={cat} className="flex justify-between text-xs py-1 border-b border-gray-50">
                  <span className="text-gray-600">{cat}</span>
                  <span className="font-semibold" style={{ color: 'var(--color-primary)' }}>
                    {parseInt(aiAmounts[cat] || '0').toLocaleString()}원
                  </span>
                </div>
              ))}
            </div>
          )}

          {(selectedPreset && income > 0) && (
            <button onClick={handleSave} disabled={loading} style={{
              width: '100%', marginTop: '4px', padding: '12px', borderRadius: '14px',
              background: savedOk ? '#2E7D52' : 'var(--color-primary)',
              color: '#fff', fontSize: '13px', fontWeight: '600', border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            }}>
              {loading ? '저장 중...' : savedOk ? '✓ 저장됨' : '이 플랜으로 저장하기'}
            </button>
          )}
        </div>
      )}

      {/* 수동 탭: 전체 요약 */}
      {tab === 'manual' && totalBudget > 0 && (
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
      {tab === 'manual' && (
        <>
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
                      <input
                        type="text" inputMode="numeric"
                        className="w-32 text-right text-sm font-semibold outline-none text-gray-800 placeholder:text-gray-300"
                        placeholder="예산 미설정"
                        value={amounts[cat] ? Number(amounts[cat]).toLocaleString() : ''}
                        onChange={(e) => handleChange(cat, e.target.value.replace(/,/g, ''))}
                      />
                      <span className="text-gray-400 text-sm">원</span>
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
            background: savedOk ? '#2E7D52' : 'var(--color-primary)',
            color: '#fff', fontSize: '14px', fontWeight: '600', border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 0.3s', fontFamily: 'inherit',
          }}>
            {loading ? '저장 중...' : savedOk ? '✓ 저장됨' : '예산 저장하기'}
          </button>
        </>
      )}
    </div>
  )
}