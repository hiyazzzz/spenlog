import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import dayjs from 'dayjs'
import { CATEGORIES } from '@/lib/themes'
import MonthNav from '@/components/analytics/MonthNav'
import CategoryDonutChart from '@/components/analytics/CategoryDonutChart'
import DailyLineChart from '@/components/analytics/DailyLineChart'

interface Props {
  searchParams: Promise<{ month?: string }>
}

export default async function AnalyticsPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { month } = await searchParams
  const currentMonth = month && /^\d{4}-\d{2}$/.test(month) ? month : dayjs().format('YYYY-MM')
  const prevMonth = dayjs(currentMonth).subtract(1, 'month').format('YYYY-MM')
  const nextMonthStart = dayjs(currentMonth).add(1, 'month').format('YYYY-MM')

  const [{ data: thisMonthExpenses }, { data: lastMonthExpenses }] = await Promise.all([
    supabase.from('expenses').select('*').eq('user_id', user.id)
      .gte('date', `${currentMonth}-01`).lt('date', `${nextMonthStart}-01`),
    supabase.from('expenses').select('*').eq('user_id', user.id)
      .gte('date', `${prevMonth}-01`).lt('date', `${currentMonth}-01`),
  ])

  const thisTotal = thisMonthExpenses?.reduce((s, e) => s + e.amount, 0) ?? 0
  const lastTotal = lastMonthExpenses?.reduce((s, e) => s + e.amount, 0) ?? 0
  const diff = thisTotal - lastTotal
  const diffPercent = lastTotal > 0 ? Math.round((diff / lastTotal) * 100) : 0

  // 카테고리별
  const byCat = CATEGORIES.map((cat) => {
    const thisAmt = thisMonthExpenses?.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0) ?? 0
    const lastAmt = lastMonthExpenses?.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0) ?? 0
    return { cat, thisAmt, lastAmt }
  }).filter(b => b.thisAmt > 0 || b.lastAmt > 0).sort((a, b) => b.thisAmt - a.thisAmt)

  const donutData = byCat.filter(b => b.thisAmt > 0).map(b => ({ name: b.cat, value: b.thisAmt }))

  // 일별 지출
  const dailyMap = new Map<number, number>()
  thisMonthExpenses?.forEach(e => {
    const day = parseInt(e.date.split('-')[2])
    dailyMap.set(day, (dailyMap.get(day) ?? 0) + e.amount)
  })
  const dailyData = Array.from(dailyMap.entries()).map(([day, amount]) => ({ day, amount })).sort((a, b) => a.day - b.day)

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--color-bg)' }}>
      <MonthNav currentMonth={currentMonth} />

      {/* 총 지출 */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 mb-4">
        <p className="text-xs text-gray-400 mb-1">총 지출</p>
        <p className="text-3xl font-bold" style={{ color: 'var(--color-primary)' }}>
          {thisTotal.toLocaleString()}원
        </p>
        {lastTotal > 0 && (
          <p className={`text-xs mt-1 font-medium ${diff > 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
            지난 달 대비 {diff > 0 ? '+' : ''}{diffPercent}% ({diff > 0 ? '+' : ''}{Math.abs(diff).toLocaleString()}원)
          </p>
        )}
        {lastTotal === 0 && <p className="text-xs mt-1 text-gray-400">지난 달 데이터 없음</p>}
      </div>

      {/* 누적 라인 차트 */}
      <DailyLineChart data={dailyData} month={currentMonth} />

      {/* 도넛 차트 */}
      <CategoryDonutChart data={donutData} total={thisTotal} />

      {/* 카테고리별 바 + 전월 대비 */}
      {byCat.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <p className="text-xs text-gray-400 mb-3">카테고리별 지출</p>
          <div className="space-y-4">
            {byCat.map(({ cat, thisAmt, lastAmt }) => {
              const catDiff = thisAmt - lastAmt
              const catDiffPct = lastAmt > 0 ? Math.round((catDiff / lastAmt) * 100) : null
              return (
                <div key={cat}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600 font-medium">{cat}</span>
                    <div className="flex items-center gap-2">
                      {catDiffPct !== null && (
                        <span className={`text-[10px] font-medium ${catDiff > 0 ? 'text-rose-400' : 'text-emerald-500'}`}>
                          {catDiff > 0 ? '▲' : '▼'}{Math.abs(catDiffPct)}%
                        </span>
                      )}
                      <span className="text-gray-800 font-semibold">{thisAmt.toLocaleString()}원</span>
                    </div>
                  </div>
                  <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div className="h-full rounded-full" style={{
                      width: `${thisTotal > 0 ? (thisAmt / thisTotal) * 100 : 0}%`,
                      background: 'var(--color-primary)',
                    }} />
                  </div>
                  {lastAmt > 0 && (
                    <p className="text-[10px] text-gray-300 mt-0.5 text-right">
                      전달 {lastAmt.toLocaleString()}원
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {byCat.length === 0 && (
        <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
          <p className="text-xs text-gray-400 py-4">이 달의 지출 내역이 없어요.</p>
        </div>
      )}
    </div>
  )
}
