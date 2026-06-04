import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import dayjs from 'dayjs'
import 'dayjs/locale/ko'
import { CATEGORIES } from '@/lib/themes'

dayjs.locale('ko')

interface Props {
  searchParams: Promise<{ month?: string }>
}

export default async function ReportPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { month } = await searchParams
  // 기본값: 전달 (이번 달 리포트는 다음 달에 의미있음)
  const defaultMonth = dayjs().subtract(1, 'month').format('YYYY-MM')
  const currentMonth = month && /^\d{4}-\d{2}$/.test(month) ? month : defaultMonth
  const nextMonth = dayjs(currentMonth).add(1, 'month').format('YYYY-MM')
  const prevMonth = dayjs(currentMonth).subtract(1, 'month').format('YYYY-MM')

  const [{ data: profile }, { data: expenses }, { data: prevExpenses }, { data: fixedCosts }] = await Promise.all([
    supabase.from('users').select('*').eq('id', user.id).single(),
    supabase.from('expenses').select('*').eq('user_id', user.id)
      .gte('date', `${currentMonth}-01`).lt('date', `${nextMonth}-01`),
    supabase.from('expenses').select('*').eq('user_id', user.id)
      .gte('date', `${prevMonth}-01`).lt('date', `${currentMonth}-01`),
    supabase.from('fixed_costs').select('*').eq('user_id', user.id),
  ])

  const totalSpent = expenses?.reduce((s, e) => s + e.amount, 0) ?? 0
  const prevTotalSpent = prevExpenses?.reduce((s, e) => s + e.amount, 0) ?? 0
  const monthlyFixed = fixedCosts?.filter(f => f.type === '월정액').reduce((s, f) => s + f.amount, 0) ?? 0
  const savingGoal = profile?.saving_goal ?? 0
  const income = profile?.income ?? 0

  // 실제 저축 = 월수입 - 해당월 총지출 - 고정비 합계
  const savedAmount = income > 0 ? Math.max(0, income - totalSpent - monthlyFixed) : 0
  const goalAchieved = savingGoal > 0 && savedAmount >= savingGoal
  const savingPct = savingGoal > 0 ? Math.min(Math.round((savedAmount / savingGoal) * 100), 100) : 0
  const spendingDiff = prevTotalSpent > 0 ? Math.round(((totalSpent - prevTotalSpent) / prevTotalSpent) * 100) : null

  const catTotals = CATEGORIES.map(cat => ({
    cat,
    amount: expenses?.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0) ?? 0,
  })).filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount)

  const dayMap = new Map<string, number>()
  expenses?.forEach(e => { dayMap.set(e.date, (dayMap.get(e.date) ?? 0) + e.amount) })
  const topDay = [...dayMap.entries()].sort((a, b) => b[1] - a[1])[0]

  const monthLabel = dayjs(currentMonth).format('YYYY년 M월')
  const isCurrentMonth = currentMonth === dayjs().format('YYYY-MM')

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--color-bg)' }}>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-semibold" style={{ color: 'var(--color-accent)' }}>월간 리포트</h1>
        <div className="flex items-center gap-2">
          <a href={`/report?month=${prevMonth}`}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-600 text-sm">‹</a>
          <span className="text-sm font-semibold text-gray-700 min-w-[72px] text-center">{monthLabel}</span>
          <a href={`/report?month=${nextMonth}`}
            className={`w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 text-sm
              ${isCurrentMonth ? 'text-gray-200 pointer-events-none' : 'text-gray-600'}`}>›</a>
        </div>
      </div>

      {/* 총평 카드 */}
      <div className="rounded-2xl p-5 mb-4 text-white" style={{ background: goalAchieved ? '#10B981' : 'var(--color-primary)' }}>
        <p className="text-sm opacity-80 mb-1">{monthLabel} 소비 총평</p>
        <p className="text-2xl font-bold mb-3">
          {goalAchieved ? '🎉 저축 목표 달성!' : savingGoal > 0 ? `목표까지 ₩${(savingGoal - savedAmount).toLocaleString()}` : `₩${totalSpent.toLocaleString()} 지출`}
        </p>
        <div className="flex gap-6 text-sm flex-wrap">
          <div>
            <p className="opacity-70 text-xs">총 지출</p>
            <p className="font-bold">₩{totalSpent.toLocaleString()}</p>
          </div>
          {income > 0 && (
            <div>
              <p className="opacity-70 text-xs">실제 저축</p>
              <p className="font-bold">₩{savedAmount.toLocaleString()}</p>
            </div>
          )}
          {savingGoal > 0 && (
            <div>
              <p className="opacity-70 text-xs">목표 달성률</p>
              <p className="font-bold">{savingPct}%</p>
            </div>
          )}
        </div>
      </div>

      {/* 전월 대비 */}
      {spendingDiff !== null && (
        <div className="bg-white rounded-2xl p-4 border border-gray-100 mb-4">
          <p className="text-xs text-gray-400 mb-2">전월 대비 지출</p>
          <p className={`text-xl font-bold ${spendingDiff > 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
            {spendingDiff > 0 ? '▲' : '▼'} {Math.abs(spendingDiff)}%
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {dayjs(prevMonth).format('M월')} ₩{prevTotalSpent.toLocaleString()} → {dayjs(currentMonth).format('M월')} ₩{totalSpent.toLocaleString()}
          </p>
        </div>
      )}

      {/* TOP 카테고리 */}
      {catTotals.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-gray-100 mb-4">
          <p className="text-xs text-gray-400 mb-3">카테고리 TOP {Math.min(catTotals.length, 3)}</p>
          <div className="space-y-3">
            {catTotals.slice(0, 3).map(({ cat, amount }, i) => (
              <div key={cat} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ background: ['var(--color-primary)', 'var(--color-primary-mid)', '#F5A5B0'][i] }}>
                  {i + 1}
                </span>
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-gray-700">{cat}</span>
                    <span className="font-bold text-gray-800">₩{amount.toLocaleString()}</span>
                  </div>
                  <div className="bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full rounded-full" style={{
                      width: `${totalSpent > 0 ? (amount / totalSpent) * 100 : 0}%`,
                      background: ['var(--color-primary)', 'var(--color-primary-mid)', '#F5A5B0'][i],
                    }} />
                  </div>
                </div>
                <span className="text-xs text-gray-400 w-10 text-right">
                  {totalSpent > 0 ? Math.round((amount / totalSpent) * 100) : 0}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {topDay && (
        <div className="bg-white rounded-2xl p-4 border border-gray-100 mb-4">
          <p className="text-xs text-gray-400 mb-2">최다 지출일</p>
          <div className="flex justify-between items-center">
            <p className="font-semibold text-gray-800">{dayjs(topDay[0]).format('M월 D일 (ddd)')}</p>
            <p className="font-bold" style={{ color: 'var(--color-primary)' }}>₩{topDay[1].toLocaleString()}</p>
          </div>
        </div>
      )}

      {totalSpent === 0 && (
        <div className="bg-white rounded-2xl p-8 border border-gray-100 text-center">
          <p className="text-gray-400 text-sm">이 달의 지출 내역이 없어요.</p>
        </div>
      )}
    </div>
  )
}
