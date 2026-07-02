'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import dayjs from 'dayjs'
import 'dayjs/locale/ko'
import ReportSlider from './ReportSlider'

dayjs.locale('ko')

interface CatData {
  cat: string; amount: number; prevAmount: number
  budget: number; budgetPct: number; prevDiff: number | null
}

interface DailyData { day: number; amount: number }
interface MonthTotal { month: string; label: string; total: number }
// pattern~action: 신규 5필드 스키마. message: 구버전 통합 메시지. step1~3: 구구버전 3단 스키마 (모두 getCoachBlocks에서 하위호환 처리)
interface Coach {
  pattern?: string; warning?: string; context?: string; solution?: string; action?: string
  message?: string
  step1?: string; step2?: string; step3?: string
}
interface TopItem { name: string; amount: number; category: string }
interface SpendCluster { label: string; amount: number; count: number }

type CoachBlock = { type: 'p' | 'warning' | 'solution'; text: string }

function getCoachBlocks(c: Coach): CoachBlock[] {
  if (c.pattern || c.solution || c.action) {
    const blocks: CoachBlock[] = []
    if (c.pattern) blocks.push({ type: 'p', text: c.pattern })
    if (c.warning) blocks.push({ type: 'warning', text: c.warning })
    if (c.context) blocks.push({ type: 'p', text: c.context })
    if (c.solution) blocks.push({ type: 'solution', text: c.solution })
    if (c.action) blocks.push({ type: 'p', text: c.action })
    return blocks
  }
  // 구버전 호환: message 또는 step1/2/3 -> 전부 일반 문단으로 (콜아웃 없이)
  const legacyText = c.message ?? [c.step1, c.step2, c.step3].filter(Boolean).join(' ')
  return legacyText.split(/\n{2,}/).map(p => p.trim()).filter(Boolean).map(text => ({ type: 'p' as const, text }))
}

// "**볼드**" 마크다운 라이트 파싱
function renderInlineBold(text: string, boldClassName: string) {
  return text.split(/(\*\*.+?\*\*)/g).filter(Boolean).map((seg, si) =>
    seg.startsWith('**') && seg.endsWith('**')
      ? <strong key={si} className={boldClassName}>{seg.slice(2, -2)}</strong>
      : <span key={si}>{seg}</span>
  )
}

// 인위적 헤더 없이 문단/볼드/콜아웃 배지만으로 가독성 확보
function renderCoachBlocks(coach: Coach) {
  return getCoachBlocks(coach).map((block, i) => {
    if (block.type === 'warning') {
      return (
        <div key={i} className="bg-red-50 text-red-600 rounded-lg p-3 text-sm leading-relaxed">
          {renderInlineBold(block.text, 'font-bold')}
        </div>
      )
    }
    if (block.type === 'solution') {
      return (
        <div key={i} className="rounded-lg py-3 px-4 text-sm leading-relaxed font-medium"
          style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
          {renderInlineBold(block.text, 'font-bold')}
        </div>
      )
    }
    return (
      <p key={i} className="text-sm text-gray-600 leading-relaxed">
        {renderInlineBold(block.text, 'font-bold text-gray-800')}
      </p>
    )
  })
}

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
  income?: number
  catData: CatData[]
  topCategory: string | null
  dailyData: DailyData[]
  noSpendDays: number
  topItems?: TopItem[]
  spendClusters?: SpendCluster[]
  txnCount?: number
  threeMonths: MonthTotal[] | null
  maxTotal: number
  patternComment: string
  cachedCoach: Coach | null
  hasEnoughData: boolean
}

export default function ReportClient({
  userId, currentMonth, prevMonth, maxMonth,
  totalSpent, prevTotalSpent, spendingDiff,
  savingGoal, savedAmount, savingPct, income,
  catData, topCategory, dailyData, noSpendDays,
  topItems, spendClusters, txnCount, threeMonths, maxTotal, patternComment,
  cachedCoach, hasEnoughData,
}: Props) {
  const router = useRouter()
  const [coach, setCoach] = useState<Coach | null>(cachedCoach)
  const [loadingCoach, setLoadingCoach] = useState(false)
  const [coachError, setCoachError] = useState('')
  const [coachErrorCode, setCoachErrorCode] = useState<'NO_DATA' | 'API_ERROR' | 'PREMIUM_REQUIRED' | 'MONTH_NOT_COMPLETE' | ''>('')
  const [btnOpacity, setBtnOpacity] = useState(1)
  const [contentOpacity, setContentOpacity] = useState(0)

  const monthLabel = dayjs(currentMonth).format('YYYY년 M월')
  const isOldest = prevMonth < dayjs().subtract(6, 'month').format('YYYY-MM')
  const canGoNext = currentMonth < maxMonth

  function loadCoachWithAnim() {
    setBtnOpacity(0)
    setTimeout(() => setContentOpacity(1), 200)
    loadCoach()
  }

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
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 20000)
      let res: Response
      try {
        res = await fetch('/api/ai-coach', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            yearMonth: currentMonth,
            totalSpent, prevTotalSpent, savingGoal, savedAmount, income,
            catData: catData.map(c => ({ cat: c.cat, amount: c.amount, prevAmount: c.prevAmount, budget: c.budget })),
            topItems, spendClusters, txnCount,
          }),
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timer)
      }
      const data = await res.json()
      if (data.coach) {
        setCoach(data.coach)
      } else if (data.error === 'PREMIUM_REQUIRED') {
        setCoachErrorCode('PREMIUM_REQUIRED')
        setCoachError('3개월 무료 체험이 끝났어요')
      } else if (data.error === 'MONTH_NOT_COMPLETE') {
        setCoachErrorCode('MONTH_NOT_COMPLETE')
        setCoachError('이번 달이 끝나면 코치를 받을 수 있어요')
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
              : savingGoal > 0
                ? '조금 아쉽지만, 다음 달엔 꼭! 💪'
                : spendingDiff !== null && spendingDiff < 0
                  ? '이번 달 잘 아꼈어요 🌿'
                  : `${totalSpent.toLocaleString()}원 지출`}
          </p>
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <p className="text-xl font-bold">
              {savingGoal > 0
                ? <>목표의 {savingPct}% 달성 <span className="text-sm font-semibold opacity-80">({savedAmount.toLocaleString()}원)</span></>
                : `이번 달 저축 ${savedAmount.toLocaleString()}원`}
            </p>
            <p className="text-xs sm:text-sm opacity-70 whitespace-nowrap shrink-0">
              {monthLabel} 총지출 {totalSpent.toLocaleString()}원
              {topCategory && <> │ 가장 많이 쓴 카테고리 &quot;{topCategory}&quot;</>}
            </p>
          </div>
        </div>

        {/* AI 코치 */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 mb-4">
          <p className="text-xs text-gray-400 mb-3">🤖 AI 코치</p>

          {!coach && !coachError && !loadingCoach && (
            <div style={{ opacity: btnOpacity, transition: 'opacity 0.2s ease', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0' }}>
              <button onClick={loadCoachWithAnim}
                className="text-xs px-5 py-2 rounded-xl text-white font-semibold"
                style={{ background: 'var(--color-primary)' }}>
                AI 코치 받기
              </button>
              <p className="text-xs text-gray-400 mt-2">AI가 이번 달 소비 패턴을 분석해드려요</p>
            </div>
          )}

          {loadingCoach && (
            <div style={{ opacity: contentOpacity, transition: 'opacity 0.3s ease' }} className="space-y-3 py-2">
              <p className="text-xs text-center mb-2" style={{ color: 'var(--color-primary-mid)' }}>AI가 분석 중이에요...</p>
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-gray-100 rounded w-full" />
                <div className="h-4 bg-gray-100 rounded w-full" />
                <div className="h-4 bg-gray-100 rounded w-4/5" />
              </div>
            </div>
          )}

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

          {coach && (
            <div style={{ opacity: contentOpacity, transition: 'opacity 0.3s ease' }} className="space-y-4">
              <div className="space-y-4">{renderCoachBlocks(coach)}</div>
              <div className="pt-3 border-t border-gray-50">
                {hasEnoughData ? (
                  <a href="/assets" className="block w-full py-3 rounded-xl text-center text-sm font-semibold text-white"
                    style={{ background: 'var(--color-primary)' }}>
                    다음 달 예산 AI 추천받기
                  </a>
                ) : (
                  <p className="text-xs text-gray-400 text-center">데이터가 쌓이면 예산 AI 추천이 활성화돼요</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 3카드 슬라이드: 카테고리별 예산사용량 / 전월대비 / 일별소비패턴 */}
        {(() => {
          const sortedCats = catData.filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount)
          const totalCatAmt = sortedCats.reduce((s, c) => s + c.amount, 0)
          const cardCls = 'bg-white rounded-2xl p-6 border border-gray-100 min-h-[420px] flex flex-col'

          const page1 = (
            <div className={cardCls}>
              <p className="text-sm font-bold text-gray-700 mb-4">카테고리별 예산 사용량</p>
              {sortedCats.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm text-gray-400 text-center">이달은 기록된 지출이 없어요</p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col gap-y-4 justify-between">
                  {sortedCats.map(c => {
                    const over = c.budget > 0 && c.amount > c.budget
                    const barColor = over ? '#EF4444' : 'var(--color-primary)'
                    return (
                      <div key={c.cat}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-semibold text-gray-700">{c.cat}</span>
                          <span className="text-sm font-bold text-gray-800">{c.amount.toLocaleString()}원</span>
                        </div>
                        {c.budget > 0 ? (
                          <>
                            <div className="bg-gray-100 rounded-full overflow-hidden" style={{ height: 12 }}>
                              <div className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${c.budgetPct}%`, background: barColor }} />
                            </div>
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              예산 대비 {c.budgetPct}% {over && '(초과)'}
                            </p>
                          </>
                        ) : (
                          <div className="bg-gray-100 rounded-full overflow-hidden" style={{ height: 12 }}>
                            <div className="h-full rounded-full bg-gray-300"
                              style={{ width: `${totalCatAmt > 0 ? Math.round((c.amount / totalCatAmt) * 100) : 0}%` }} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )

          const top5Cats = sortedCats.slice(0, 5)
          const page2 = (
            <div className={cardCls}>
              <p className="text-sm font-bold text-gray-700 mb-4">🔄 전월 대비 지출 비교</p>
              {top5Cats.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm text-gray-400 text-center">이달은 기록된 지출이 없어요</p>
                </div>
              ) : (
                <div className="flex flex-col gap-y-3 max-h-[260px] overflow-y-auto custom-scrollbar pr-1">
                  {top5Cats.map(c => {
                    const diff = c.amount - c.prevAmount
                    const isNew = c.prevAmount === 0
                    return (
                      <div key={c.cat} className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-gray-700">{c.cat}</span>
                        {isNew ? (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">신규</span>
                        ) : (
                          <span className={`text-sm font-bold ${diff > 0 ? 'text-rose-500' : diff < 0 ? 'text-emerald-500' : 'text-gray-400'}`}>
                            {diff > 0 ? '🔺' : diff < 0 ? '🔽' : '-'} {Math.abs(diff).toLocaleString()}원
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )

          const firstDow = dayjs(currentMonth).startOf('month').day()
          const weekLabels = ['일', '월', '화', '수', '목', '금', '토']
          const page3 = (
            <div className={cardCls}>
              <p className="text-sm font-bold text-gray-700 mb-4">📅 일별 소비 패턴</p>
              <span className="inline-block text-xs font-bold px-3 py-1.5 rounded-full mb-4"
                style={{ background: 'var(--color-primary-mid)', color: 'white' }}>
                무지출 데이 {noSpendDays}일
              </span>
              {dailyData.length === 0 || totalSpent === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm text-gray-400 text-center">일별 데이터가 없어요</p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col">
                  <div className="grid grid-cols-7 gap-1 text-center mb-1">
                    {weekLabels.map(w => (
                      <div key={w} className="text-[10px] text-gray-400 font-medium">{w}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: firstDow }).map((_, i) => (
                      <div key={`blank-${i}`} />
                    ))}
                    {dailyData.map(d => {
                      const isNoSpend = d.amount === 0
                      return (
                        <div key={d.day} className="relative group flex flex-col items-center justify-center h-10 w-full rounded-md">
                          <div className={`w-full h-full flex items-center justify-center rounded-md text-xs ${isNoSpend ? 'bg-[var(--color-primary)]/70 text-white font-bold' : 'text-gray-800'}`}>
                            {d.day}
                          </div>
                          {!isNoSpend && d.amount > 0 && (
                            <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center z-50 pointer-events-none">
                              <div className="bg-gray-900 text-white text-[10px] rounded-md py-1 px-2 whitespace-nowrap shadow-lg">
                                {d.amount.toLocaleString()}원
                              </div>
                              <div className="w-2 h-2 bg-gray-900 rotate-45 -mt-1" />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )

          return <ReportSlider pages={[page1, page2, page3]} />
        })()}

        {/* 3개월 패턴 */}
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

      </>)}
    </div>
  )
}
