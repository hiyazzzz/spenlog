import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import dayjs from 'dayjs'
import { CATEGORIES } from '@/lib/themes'
import MonthNav from '@/components/analytics/MonthNav'
import CategoryDonutChart from '@/components/analytics/CategoryDonutChart'

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
    supabase
      .from('expenses')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', `${currentMonth}-01`)
      .lt('date', `${nextMonthStart}-01`),
    supabase
      .from('expenses')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', `${prevMonth}-01`)
      .lt('date', `${currentMonth}-01`),
  ])

  const thisTotal = thisMonthExpenses?.reduce((s, e) => s + e.amount, 0) ?? 0
  const lastTotal = lastMonthExpenses?.reduce((s, e) => s + e.amount, 0) ?? 0
  const diff = thisTotal - lastTotal
  const diffPercent = lastTotal > 0 ? Math.round((diff / lastTotal) * 100) : 0

  const byCat = CATEGORIES.map((cat) => ({
    cat,
    amount: thisMonthExpenses?.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0) ?? 0,
  })).filter(b => b.amount > 0).sort((a, b) => b.amount - a.amount)

  const donutData = byCat.map(b => ({ name: b.cat, value: b.amount }))

  return (
    <div className="min-h-screen bg-[#FAF7F4] pb-20">
      <MonthNav currentMonth={currentMonth} />

      <div className="bg-white rounded-2xl p-4 border border-gray-100 mb-4">
        <p className="text-xs text-gray-400 mb-1">총 지출</p>
        <p className="text-3xl font-bold text-[#6B1E2E]">\u20a9{thisTotal.toLocaleString()}</p>
        {lastTotal > 0 && (
          <p className={`text-xs mt-1 font-medium ${diff > 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
            지난 달 대비 {diff > 0 ? '+' : ''}{diffPercent}%
          </p>
        )}
        {lastTotal === 0 && (
          <p className="text-xs mt-1 text-gray-400">지난 달 데이터 없음</p>
        )}
      </div>

      <CategoryDonutChart data={donutData} total={thisTotal} />

      {byCat.length > 0 ? (
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <p className="text-xs text-gray-400 mb-3">카테고리별 지출</p>
          <div className="space-y-3">
            {byCat.map(({ cat, amount }) => (
              <div key={cat}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-600 font-medium">{cat}</span>
                  <span className="text-gray-800 font-semibold">\u20a9{amount.toLocaleString()}</span>
                </div>
                <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-[#6B1E2E] rounded-full"
                    style={{ width: `${thisTotal > 0 ? (amount / thisTotal) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
          <p className="text-xs text-gray-400 py-4">이 달의 지출 내역이 없어요.</p>
        </div>
      )}
    </div>
  )
}
