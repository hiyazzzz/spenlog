'use client'
import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Budget } from '@spenlog/types'
import { TEXTS } from '@/config/texts'

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
  customCategories?: string[]  // 유저 커스텀 카테고리
}

// 저축 플랜 — 감각적 네이밍
const PRESETS = [
  {
    key: '알뜰',
    label: '💰 알뜰하게',
    desc: '수입의 40% 저축',
    savingRate: 0.40,
    dist: { 생활비: 0.40, 고정비: 0.35, 활동비: 0.25 },
  },
  {
    key: '균형',
    label: '⚖️ 균형있게',
    desc: '수입의 25% 저축',
    savingRate: 0.25,
    dist: { 생활비: 0.40, 고정비: 0.30, 활동비: 0.30 },
  },
  {
    key: '여유',
    label: '🌈 여유있게',
    desc: '수입의 15% 저축',
    savingRate: 0.15,
    dist: { 생활비: 0.35, 고정비: 0.25, 활동비: 0.40 },
  },
] as const

// DB에 저장된 값을 기준으로 초기 amounts 생성
function getInitialAmounts(initialBudgets: Budget[], allCategories: string[]) {
  return Object.fromEntries(allCategories.map(cat => [
    cat,
    initialBudgets.find(b => b.category === cat)?.amount.toString() || ''
  ]))
}

export default function BudgetForm({ userId, initialBudgets, expenses, thisMonth, income, fixedSavings = 0, recentExpenses = [], customCategories }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [tab, setTab] = useState<'manual' | 'ai'>('manual')
  const [loading, setLoading] = useState(false)
  const [savedOk, setSavedOk] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiReason, setAiReason] = useState<string | null>(null)
  const [aiToast, setAiToast] = useState<string | null>(null)

  const DEFAULT_CATEGORIES = ['생활비', '고정비', '활동비']
  // '수입' 카테고리는 예산 설정 대상 제외
  const allCategories = (customCategories && customCategories.length > 0 ? customCategories : DEFAULT_CATEGORIES)
    .filter(cat => cat !== '수입')
  // ON/OFF 토글 - 기본값: 이미 예산 설정된 카테고리는 ON
  const [enabledCats, setEnabledCats] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {}
    allCategories.forEach(cat => {
      map[cat] = initialBudgets.some(b => b.category === cat && b.amount > 0)
      if (!map[cat]) map[cat] = false
    })
    // 설정된 게 하나도 없으면 첫 3개 ON
    const anyOn = Object.values(map).some(Boolean)
    if (!anyOn) allCategories.slice(0, 3).forEach(cat => { map[cat] = true })
    return map
  })

  // savedAmounts: DB 저장된 값 (탭 전환해도 유지)
  const savedAmounts = useMemo(() => getInitialAmounts(initialBudgets, allCategories), [initialBudgets, allCategories])

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

    const knownDist = preset.dist as Record<string, number>
    const unknownCats = allCategories.filter(cat => !(cat in knownDist) && cat !== '수입')
    const knownRatio = allCategories.filter(cat => cat in knownDist).reduce((s, cat) => s + (knownDist[cat] ?? 0), 0)
    const unknownRatio = unknownCats.length > 0 ? Math.max(0, 1 - knownRatio) / unknownCats.length : 0
    const newAmounts = Object.fromEntries(
      allCategories.map(cat => {
        if (cat === '수입') return [cat, '0']
        const ratio = cat in knownDist ? (knownDist[cat] ?? 0) : unknownRatio
        return [cat, Math.round(spendBudget * ratio).toString()]
      })
    )
    setAiAmounts(newAmounts)

    // AI 탭에서 바로 manual amounts에도 반영 (저장 시 이 값으로)
    setAmounts(newAmounts)
  }

  async function handleAiRecommend() {
    if (!income) {
      setAiToast(TEXTS.budget.toastNoIncome)
      setTimeout(() => setAiToast(null), 3000)
      return
    }
    setAiLoading(true)
    setAiReason(null)
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 12000)
      let res: Response
      try {
        res = await fetch('/api/budget-recommend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            income,
            fixedSavings,
            recentExpenses,
            currentBudgets: initialBudgets.map(b => ({ category: b.category, amount: b.amount })),
            categories: allCategories,
          }),
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timer)
      }
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? 'API_ERROR')

      const newAmounts = Object.fromEntries(
        Object.entries(data.amounts as Record<string, number>).map(([k, v]) => [k, String(v)])
      )
      setAiAmounts(newAmounts)
      setAmounts(newAmounts)
      setSelectedPreset('ai-custom')
      setAiReason(data.reason ?? null)
      setAiToast(TEXTS.budget.toastAIDone)
      setTimeout(() => setAiToast(null), 3000)
    } catch {
      const fallback = fallbackAmounts(income, fixedSavings)
      const newAmounts = Object.fromEntries(Object.entries(fallback).map(([k, v]) => [k, String(v)]))
      setAiAmounts(newAmounts)
      setAmounts(newAmounts)
      setSelectedPreset('ai-custom')
      setAiToast(TEXTS.budget.toastAIDone)
      setTimeout(() => setAiToast(null), 3000)
    } finally {
      setAiLoading(false)
    }
  }

  function fallbackAmounts(inc: number, _fixed: number): Record<string, number> {
    const spendBudget = inc - Math.round(inc * 0.25)
    const dist: Record<string, number> = { '생활비': 0.40, '고정비': 0.35, '활동비': 0.25 }
    const spendCats = allCategories.filter(cat => cat !== '수입')
    const knownRatio = spendCats.filter(cat => cat in dist).reduce((s, cat) => s + (dist[cat] ?? 0), 0)
    const unknownCats = spendCats.filter(cat => !(cat in dist))
    const unknownRatio = unknownCats.length > 0 ? Math.max(0, 1 - knownRatio) / unknownCats.length : 0
    return Object.fromEntries(
      allCategories.map(cat => {
        if (cat === '수입') return [cat, 0]
        const ratio = cat in dist ? (dist[cat] ?? 0) : unknownRatio
        return [cat, Math.round(spendBudget * ratio)]
      })
    )
  }

  async function handleSave() {
    setLoading(true)
    const onCats = allCategories.filter(cat => enabledCats[cat])
    const offCats = allCategories.filter(cat => !enabledCats[cat])

    // ON 카테고리: upsert
    const source = tab === 'ai' && selectedPreset ? 'ai' : 'manual'
    if (onCats.length > 0) {
      const upsertData = onCats.map(cat => ({
        user_id: userId,
        category: cat,
        amount: parseInt(amounts[cat] || '0'),
        month: thisMonth,
        source,
      }))
      await supabase.from('budgets').upsert(upsertData, { onConflict: 'user_id,category,month' })
    }
    // OFF 카테고리: 기존 예산 삭제 (달성률 계산 오염 방지)
    if (offCats.length > 0) {
      await supabase.from('budgets')
        .delete()
        .eq('user_id', userId)
        .eq('month', thisMonth)
        .in('category', offCats)
    }

    setLoading(false)
    setSavedOk(true)
    setTimeout(() => setSavedOk(false), 2000)
    router.refresh()
  }

  const displayAmounts = tab === 'ai' && selectedPreset ? aiAmounts : amounts
  const totalBudget = allCategories.filter(c => enabledCats[c]).reduce((s, c) => s + (parseInt(displayAmounts[c] || '0') || 0), 0)
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
            {t === 'manual' ? TEXTS.budget.tabManual : TEXTS.budget.tabAI}
          </button>
        ))}
      </div>

      {/* AI 추천 탭 */}
      {tab === 'ai' && (
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          {income > 0 ? (
            <>
              <p className="text-xs text-gray-400 mb-1">
                {TEXTS.budget.incomeBasis(income)}
              </p>
              {fixedSavings > 0 && (
                <p className="text-xs text-emerald-600 mb-3">
                  {TEXTS.budget.fixedSavingNote(fixedSavings)}
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-gray-400 mb-3">
              <a href="/assets" style={{ color: 'var(--color-primary)' }}>{TEXTS.budget.assetTabName}</a>{TEXTS.budget.assetLinkNote}
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
                      {TEXTS.budget.spendBudget(spendBudget)}
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
              <>{TEXTS.budget.btnAIRecommend}</>
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
          {selectedPreset && selectedPreset !== 'ai-custom' && income > 0 && (() => {
            const preset = PRESETS.find(p => p.key === selectedPreset)
            if (!preset) return null
            const targetSave = Math.round(income * preset.savingRate)
            const addSave = Math.max(0, targetSave - fixedSavings)
            return (
              <div className="rounded-xl p-3 mb-3" style={{ background: 'rgba(16,185,129,0.08)' }}>
                <p className="text-xs font-semibold text-emerald-700 mb-2">{TEXTS.budget.savingPlanTitle}</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">{TEXTS.budget.savingTarget}</span>
                    <span className="font-semibold text-emerald-600">{targetSave.toLocaleString()}원</span>
                  </div>
                  {fixedSavings > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">{TEXTS.budget.savingFixed}</span>
                      <span className="font-medium text-gray-600">{fixedSavings.toLocaleString()}원</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs border-t border-emerald-100 pt-1 mt-1">
                    <span className="text-gray-500">{TEXTS.budget.savingExtra}</span>
                    <span className="font-bold text-emerald-700">{addSave.toLocaleString()}원</span>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* 카테고리별 배분 */}
          {selectedPreset && income > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-gray-400 mb-2">{TEXTS.budget.distTitle}</p>
              {allCategories.map(cat => (
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
              {loading ? TEXTS.budget.btnSavePlanSaving : savedOk ? TEXTS.budget.btnSavePlanSaved : TEXTS.budget.btnSavePlan}
            </button>
          )}
        </div>
      )}

      {/* 수동 탭: 전체 요약 */}
      {tab === 'manual' && totalBudget > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <div className="flex justify-between text-xs mb-2">
            <span className="text-gray-500 font-medium">{TEXTS.budget.totalProgress}</span>
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
            <span>{TEXTS.budget.spentLabel(totalSpent)}</span>
            <span>{TEXTS.budget.budgetLabel(totalBudget)}</span>
          </div>
        </div>
      )}

      {/* 수동 입력 */}
      {tab === 'manual' && (
        <>
          <div className="space-y-3">
            {allCategories.map((cat) => {
              const spent = expenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0)
              const budget = parseInt(amounts[cat] || '0') || 0
              const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0
              const over = spent > budget && budget > 0

              return (
                <div key={cat} style={{ marginBottom: 12, opacity: enabledCats[cat] ? 1 : 0.45 }}>
                  {/* 한 줄: [카테고리명(no box)] [금액입력(white box)] [토글(no box)] */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/* 카테고리명 */}
                    <span style={{
                      fontSize: 13, fontWeight: 600, color: 'var(--color-accent)',
                      minWidth: 44, flexShrink: 0,
                    }}>{cat}</span>
                    {/* 금액 입력 흰박스 */}
                    <div style={{
                      flex: 1, background: '#fff', borderRadius: 12,
                      border: '1px solid #f0f0f0', padding: '9px 12px',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      <input
                        type="text" inputMode="numeric"
                        style={{
                          flex: 1, border: 'none', outline: 'none', background: 'transparent',
                          fontSize: 13, fontWeight: 600, color: '#374151',
                          textAlign: 'right', fontFamily: 'inherit',
                        }}
                        placeholder={TEXTS.budget.placeholderAmount}
                        value={amounts[cat] ? Number(amounts[cat]).toLocaleString() : ''}
                        onChange={(e) => handleChange(cat, e.target.value.replace(/,/g, ''))}
                        disabled={!enabledCats[cat]}
                      />
                      <span style={{ fontSize: 12, color: '#9ca3af', flexShrink: 0 }}>{TEXTS.budget.unitWon}</span>
                    </div>
                    {/* 토글 */}
                    <button
                      onClick={() => setEnabledCats(prev => ({ ...prev, [cat]: !prev[cat] }))}
                      style={{
                        width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
                        background: enabledCats[cat] ? 'var(--color-primary)' : '#d1d5db',
                        position: 'relative', flexShrink: 0, transition: 'background 0.2s',
                      }}
                    >
                      <div style={{
                        position: 'absolute', top: 3, left: enabledCats[cat] ? 20 : 3,
                        width: 16, height: 16, borderRadius: '50%', background: '#fff',
                        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }} />
                    </button>
                  </div>
                  {/* 프로그레스 바 — 금액 입력 박스 아래 정렬 */}
                  {budget > 0 && (
                    <div style={{ paddingLeft: 52, paddingRight: 48, marginTop: 4 }}>
                      <div style={{ background: '#f3f4f6', borderRadius: 4, height: 4, overflow: 'hidden', marginBottom: 3 }}>
                        <div style={{
                          height: '100%', borderRadius: 4,
                          width: `${Math.min(pct, 100)}%`,
                          background: over ? '#EF4444' : pct >= 80 ? '#F59E0B' : 'var(--color-primary)',
                        }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 10, color: over ? '#ef4444' : '#9ca3af', fontWeight: over ? 600 : 400 }}>
                          {spent > 0 ? TEXTS.budget.spentAmount(spent) : TEXTS.budget.spentNoExpense}
                        </span>
                        <span style={{ fontSize: 10, color: '#9ca3af' }}>{pct}%{over ? ' 초과!' : ''}</span>
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
            {loading ? TEXTS.budget.btnSaveManualSaving : savedOk ? TEXTS.budget.btnSaveManualSaved : TEXTS.budget.btnSaveManual}
          </button>
        </>
      )}
    </div>
  )
}
