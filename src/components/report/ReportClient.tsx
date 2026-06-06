'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import dayjs from 'dayjs'
import 'dayjs/locale/ko'

dayjs.locale('ko')

interface CatData {
  cat: string; amount: number; prevAmount: number
  budget: number; budgetPct: number; prevDiff: number | null
}

interface MonthTotal { month: string; label: string; total: number }
interface Coach { step1: string; step2: string; step3: string }

interface Props {
  userId: string
  currentMonth: string
  prevMonth: string
  maxMonth: string
  totalSpent: number
  prevTotalSpent: number
  spendingDiff: number | null
  savingGoal: number
  savedAmount: number
  savingPct: number
  catData: CatData[]
  threeMonths: MonthTotal[] | null
  maxTotal: number
  patternComment: string
  cachedCoach: Coach | null
  hasEnoughData: boolean
}

export default function ReportClient({
  userId, currentMonth, prevMonth, maxMonth,
  totalSpent, prevTotalSpent, spendingDiff,
  savingGoal, savedAmount, savingPct,
  catData, threeMonths, maxTotal, patternComment,
  cachedCoach, hasEnoughData,
}: Props) {
  const router = useRouter()
  const [coach, setCoach] = useState<Coach | null>(cachedCoach)
  const [loadingCoach, setLoadingCoach] = useState(false)
  const [coachError, setCoachError] = useState('')
  const [coachErrorCode, setCoachErrorCode] = useState<'NO_DATA' | 'API_ERROR' | 'PREMIUM_REQUIRED' | ''>('')

  const monthLabel = dayjs(currentMonth).format('YYYY년 M월')
  const isOldest = prevMonth < dayjs().subtract(6, 'month').format('YYYY-MM')
  const canGoNext = currentMonth < maxMonth

  async function loadCoach() {
    if (coach) return
    setLoadingCoach(true)
    setCoachError('')
    setCoachErrorCode('')
    try {
      if (totalSpent === 0) {
        setCoachErrorCode('NO_DATA')
        setCoachError('이 달 기록된 지출이 없어요')
        setLoadingCoach(false)
        return
      }
      const res = await fetch('/api/ai-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          yearMonth: currentMonth,
          totalSpent, prevTotalSpent, savingGoal, savedAmount,
          catData: catData.map(c => ({ cat: c.cat, amount: c.amount, prevAmount: c.prevAmount })),
        }),
      })
      const data = await res.json()
      if (data.coach) {
        setCoach(data.coach)
      } else if (data.error === 'PREMIUM_REQUIRED') {
        setCoachErrorCode('PREMIUM_REQUIRED')
        setCoachError('3개월 무료 체험이 끝났어요')
      } else {
        setCoachErrorCode('API_ERROR')
        setCoachError('AI 코치를 일시적으로 이용할 수 없어요')
      }
    } catch {
      setCoachErrorCode('API_ERROR')
      setCoachError('네트워크 오류가 발생했어요')
    } finally {
      setLoadingCoach(false)
    }
  }

  const goalAchieved = savingGoal > 0 && savedAmount >= savingGoal
  const headerBg = goalAchieved ? '#10B981' : 'var(--color-primary)'

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--color-bg)' }}>
      {/* 월 네비게이션 */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold" style={{ color: 'var(--color-accent)' }}>리포트</h1>
        <div className="flex items-center gap-2">
          <a href={`/report?month=${prevMonth}`}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-600 text-sm">‹</a>
          <span className="text-sm font-bold text-gray-700 min-w-[80px] text-center">{monthLabel}</span>
          <a href={`/report?month=${dayjs(currentMonth).add(1, 'month').format('YYYY-MM')}`}
            className={`w-8 h-8 flex items-center justify-center rounded-full bg-white border text-sm transition-colors
              ${canGoNext ? 'border-gray-200 text-gray-600' : 'border-gray-100 text-gray-200 pointer-events-none'}`}>›</a>
        </div>
      </div>

      {/* 빈 상태 */}
      {totalSpent === 0 && (
        <div className="bg-white rounded-2xl p-8 border border-gray-100 text-center">
          <p className="text-4xl mb-3">🌿</p>
          <p className="text-gray-500 text-sm font-medium mb-2">아직 리포트가 없어요</p>
          <p className="text-gray-400 text-xs leading-relaxed">
            이번 달 지출을 기록하면<br />다음 달 1일에 첫 리포트가 공개돼요!
          </p>
          <a href="/" className="mt-4 inline-block text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
            첫 기록 남기기 →
          </a>
        </div>
      )}

      {totalSpent > 0 && (<>

        {/* [1] 헤더 카드 */}
        <div className="rounded-2xl p-5 mb-4 text-white" style={{ background: headerBg }}>
          <p className="text-xs opacity-70 mb-1">{monthLabel} 소비 총평</p>
          <p className="text-2xl font-extrabold mb-3">
            {goalAchieved
              ? '저축 목표 달성! 🎉'
              : spendingDiff !== null && spendingDiff < 0
                ? '이번 달 잘 아꼈어요 🌿'
                : savingGoal > 0
                  ? `목표까지 ₩${(savingGoal - savedAmount).toLocaleString()}`
                  : `₩${totalSpent.toLocaleString()} 지출`}
          </p>
          <div className="flex gap-5 text-sm flex-wrap">
            <div>
              <p className="opacity-60 text-xs">총 지출</p>
              <p className="font-bold">{totalSpent.toLocaleString()}원</p>
            </div>
            {savingGoal > 0 && (
              <div>
                <p className="opacity-60 text-xs">실제 저축</p>
                <p className="font-bold">{savedAmount.toLocaleString()}원</p>
              </div>
            )}
            {savingGoal > 0 && (
              <div>
                <p className="opacity-60 text-xs">달성률</p>
                <p className="font-bold">{savingPct}%</p>
              </div>
            )}
          </div>
        </div>

        {/* [2] 총 지출 전월 대비 */}
        {spendingDiff !== null && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100 mb-4">
            <p className="text-xs text-gray-400 mb-2">전월 대비 지출</p>
            <div className="flex items-end gap-3">
              <p className={`text-2xl font-extrabold ${spendingDiff > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                {spendingDiff > 0 ? '▲' : '▼'} {Math.abs(spendingDiff)}%
              </p>
              <p className="text-xs text-gray-400 mb-1">
                ({spendingDiff > 0 ? '+' : ''}{(totalSpent - prevTotalSpent).toLocaleString()}원)
              </p>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              전달 {prevTotalSpent.toLocaleString()}원 → 이번 달 {totalSpent.toLocaleString()}원
            </p>
          </div>
        )}

        {/* [3] 저축 목표 달성률 */}
        {savingGoal > 0 && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100 mb-4">
            <p className="text-xs text-gray-400 mb-3">🎯 저축 목표 달성률</p>
            <div className="flex justify-between items-end mb-2">
              <div>
                <p className="text-xl font-extrabold" style={{ color: goalAchieved ? '#10B981' : 'var(--color-accent)' }}>
                  {savedAmount.toLocaleString()}원
                </p>
                <p className="text-xs text-gray-400">목표 {savingGoal.toLocaleString()}원</p>
              </div>
              <p className={`text-3xl font-extrabold ${goalAchieved ? 'text-emerald-500' : savingPct >= 70 ? 'text-amber-500' : 'text-rose-400'}`}>
                {savingPct}%
              </p>
            </div>
            <div className="bg-gray-100 rounded-full h-2.5 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${savingPct}%`,
                  background: goalAchieved ? '#10B981' : savingPct >= 70 ? '#f59e0b' : '#ef4444',
                }} />
            </div>
            {goalAchieved && <p className="text-xs text-emerald-500 mt-2 font-semibold">🎉 목표 달성! 대단해요</p>}
          </div>
        )}

        {/* [4] 카테고리별 지출 */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 mb-4">
          <p className="text-xs text-gray-400 mb-4">📊 카테고리별 지출</p>
          <div className="space-y-4">
            {catData.filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount).map(c => {
              const over = c.budget > 0 && c.amount > c.budget
              const barColor = c.budgetPct >= 90 ? '#ef4444' : c.budgetPct >= 70 ? '#f59e0b' : 'var(--color-primary)'
              return (
                <div key={c.cat}>
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">{c.cat}</span>
                      {c.prevDiff !== null && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full
                          ${Math.abs(c.prevDiff) >= 20
                            ? c.prevDiff > 0 ? 'bg-rose-50 text-rose-400' : 'bg-emerald-50 text-emerald-500'
                            : 'bg-gray-100 text-gray-400'}`}>
                          {c.prevDiff > 0 ? '▲' : '▼'}{Math.abs(c.prevDiff)}%
                          {c.prevDiff >= 20 && ' ⚠️'}
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-bold text-gray-800">{c.amount.toLocaleString()}원</span>
                  </div>
                  {c.budget > 0 ? (
                    <>
                      <div className="bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${c.budgetPct}%`, background: barColor }} />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        예산 대비 {c.budgetPct}% {over && '(초과)'}
                      </p>
                    </>
                  ) : (
                    <div className="bg-gray-100 rounded-full h-1 overflow-hidden">
                      <div className="h-full rounded-full bg-gray-300"
                        style={{ width: `${totalSpent > 0 ? Math.round((c.amount / totalSpent) * 100) : 0}%` }} />
                    </div>
                  )}
                </div>
              )
            })}
            {catData.every(c => c.amount === 0) && (
              <p className="text-sm text-gray-400 text-center py-4">이달은 기록된 지출이 없어요</p>
            )}
          </div>
        </div>

        {/* [5] 3개월 패턴 */}
        {threeMonths && threeMonths[0].total > 0 && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100 mb-4">
            <p className="text-xs text-gray-400 mb-3">📈 3개월 패턴</p>
            <div className="space-y-2">
              {threeMonths.map((m, i) => (
                <div key={m.month} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-8">{m.label}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                    <div className="h-full rounded-full flex items-center transition-all duration-500"
                      style={{
                        width: `${maxTotal > 0 ? Math.round((m.total / maxTotal) * 100) : 0}%`,
                        background: i === threeMonths.length - 1 ? 'var(--color-primary)' : 'var(--color-primary-mid)',
                        minWidth: m.total > 0 ? 8 : 0,
                      }} />
                  </div>
                  <span className="text-xs font-bold text-gray-700 w-20 text-right">
                    {m.total > 0 ? (m.total >= 10000 ? `${Math.round(m.total / 10000)}원만` : m.total.toLocaleString()) : '-'}
                  </span>
                </div>
              ))}
            </div>
            {patternComment && (
              <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-50">
                {patternComment}
              </p>
            )}
          </div>
        )}

        {/* [6] AI 코치 */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-400">🤖 AI 코치</p>
            {!coach && !coachError && (
              <button onClick={loadCoach} disabled={loadingCoach}
                className="text-xs px-3 py-1.5 rounded-xl text-white font-semibold disabled:opacity-60"
                style={{ background: 'var(--color-primary)' }}>
                {loadingCoach ? '분석 중...' : 'AI 코치 받기'}
              </button>
            )}
          </div>

          {/* 로딩 스켈레톤 */}
          {loadingCoach && (
            <div className="space-y-3 py-2">
              <p className="text-xs text-center" style={{ color: 'var(--color-primary-mid)' }}>
                AI가 분석 중이에요...
              </p>
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse">
                  <div className="h-3 bg-gray-100 rounded w-24 mb-2" />
                  <div className="h-4 bg-gray-100 rounded w-full mb-1" />
                  <div className="h-4 bg-gray-100 rounded w-4/5" />
                </div>
              ))}
            </div>
          )}

          {/* 에러 케이스별 UI */}
          {coachError && !loadingCoach && (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500 mb-3">{coachError}</p>
              {coachErrorCode === 'NO_DATA' && (
                <a href="/" className="inline-block text-sm font-semibold px-4 py-2 rounded-xl text-white"
                  style={{ background: 'var(--color-primary)' }}>
                  지출 기록하러 가기
                </a>
              )}
              {coachErrorCode === 'API_ERROR' && (
                <button onClick={() => { setCoachError(''); setCoachErrorCode(''); loadCoach() }}
                  className="text-sm font-semibold px-4 py-2 rounded-xl text-white"
                  style={{ background: 'var(--color-primary)' }}>
                  다시 시도
                </button>
              )}
              {coachErrorCode === 'PREMIUM_REQUIRED' && (
                <a href="/premium" className="inline-block text-sm font-semibold px-4 py-2 rounded-xl text-white"
                  style={{ background: 'var(--color-primary)' }}>
                  프리미엄 시작하기
                </a>
              )}
            </div>
          )}

          {coach ? (
            <div className="space-y-4">
              {([
                { step: '1', title: '패턴 진단', content: coach.step1 },
                { step: '2', title: '동기부여', content: coach.step2 },
                { step: '3', title: '행동 제안', content: coach.step3 },
              ] as const).map(({ step, title, content: c }) => (
                <div key={title}>
                  <p className="text-xs font-bold text-gray-700 mb-1">{step} {title}</p>
                  <p className="text-sm text-gray-600 leading-relaxed">{c}</p>
                </div>
              ))}

              <div className="pt-3 border-t border-gray-50">
                {hasEnoughData ? (
                  <a href="/assets" className="block w-full py-3 rounded-xl text-center text-sm font-semibold text-white"
                    style={{ background: 'var(--color-primary)' }}>
                    다음 달 예산 AI 추천받기
                  </a>
                ) : (
                  <div className="text-center">
                    <p className="text-xs text-gray-400">
                      데이터가 쌓이면 예산 AI 추천이 활성화돼요
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : !loadingCoach && !coachError && (
            <div className="text-center py-4">
              <p className="text-sm text-gray-400">AI가 이번 달 소비 패턴을 분석해드려요</p>
            </div>
          )}
        </div>

      </>)}
    </div>
  )
}
