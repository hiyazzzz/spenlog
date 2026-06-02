import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import dayjs from 'dayjs'
import { CATEGORIES } from '@/lib/themes'

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const thisMonth = dayjs().format('YYYY-MM')
  const lastMonth = dayjs().subtract(1, 'month').format('YYYY-MM')

  const { data: thisMonthExpenses } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', user.id)
    .gte('date', `${thisMonth}-01`)

  const { data: lastMonthExpenses } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', user.id)
    .gte('date', `${lastMonth}-01`)
    .lt('date', `${thisMonth}-01`)

  const thisTotal = thisMonthExpenses?.reduce((s, e) => s + e.amount, 0) ?? 0
  const lastTotal = lastMonthExpenses?.reduce((s, e) => s + e.amount, 0) ?? 0
  const diff = thisTotal - lastTotal
  const diffPercent = lastTotal > 0 ? Math.round((diff / lastTotal) * 100) : 0

  // 카테고리별 합계
  const byCat = CATEGORIES.map((cat) => ({
    cat,
    amount: thisMonthExpenses?.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0) ?? 0,
  }))

  return (
    <div className="min-h-screen bg-[#FAF7F4] px-4 pt-6 pb-20">
      <h1 className="text-lg font-semibold text-[#4A1220] mb-5">분석</h1>

      {/* 전월 비교 */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 mb-4">
        <p className="text-xs text-gray-400 mb-1">이번 달 지출</p>
        <p className="text-3xl font-bold text-[#6B1E2E]">₩{thisTotal.toLocaleString()}</p>
        <p className={`text-xs mt-1 font-medium ${diff > 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
          지난 달 대비 {diff > 0 ? '+' : ''}{diffPercent}%
          ({diff > 0 ? '+' : ''}₩{Math.abs(diff).toLocaleString()})
        </p>
      </div>

      {/* 카테고리별 바 */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 mb-4">
        <p className="text-xs text-gray-400 mb-3">카테고리별 지출</p>
        <div className="space-y-3">
          {byCat
            .filter(b => b.amount > 0)
            .sort((a, b) => b.amount - a.amount)
            .map(({ cat, amount }) => (
              <div key={cat}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-600 font-medium">{cat}</span>
                  <span className="text-gray-800 font-semibold">₩{amount.toLocaleString()}</span>
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
    </div>
  )
}