import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import dayjs from 'dayjs'
import 'dayjs/locale/ko'
import ReportClient from '@/components/report/ReportClient'

dayjs.locale('ko')

interface Props {
  searchParams: Promise<{ month?: string }>
}

export default async function ReportPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { month } = await searchParams
  const defaultMonth = dayjs().subtract(1, 'month').format('YYYY-MM')
  const maxMonth = dayjs().subtract(1, 'month').format('YYYY-MM')
  const rawMonth = month && /^\d{4}-\d{2}$/.test(month) ? month : defaultMonth
  const safeMonth = rawMonth > maxMonth ? maxMonth : rawMonth

  const nextMonth = dayjs(safeMonth).add(1, 'month').format('YYYY-MM')
  const prevMonth = dayjs(safeMonth).subtract(1, 'month').format('YYYY-MM')
  const prev2Month = dayjs(safeMonth).subtract(2, 'month').format('YYYY-MM')

  const [
    { data: profile },
    { data: expenses },
    { data: prevExpenses },
    { data: prev2Expenses },
    { data: budgets },
    { data: cachedReport },
    { data: categoriesData },
  ] = await Promise.all([
    supabase.from('users').select('*').eq('id', user.id).single(),
    supabase.from('expenses').select('*').eq('user_id', user.id)
      .gte('date', `${safeMonth}-01`).lt('date', `${nextMonth}-01`),
    supabase.from('expenses').select('amount, category, type').eq('user_id', user.id)
      .gte('date', `${prevMonth}-01`).lt('date', `${safeMonth}-01`),
    supabase.from('expenses').select('amount, type').eq('user_id', user.id)
      .gte('date', `${prev2Month}-01`).lt('date', `${prevMonth}-01`),
    supabase.from('budgets').select('*').eq('user_id', user.id).eq('month', safeMonth),
    supabase.from('reports').select('ai_coach').eq('user_id', user.id).eq('year_month', safeMonth).single(),
    supabase.from('categories').select('name').eq('user_id', user.id).eq('is_hidden', false).order('sort_order'),
  ])

  const totalSpent = expenses?.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0) ?? 0
  const prevTotalSpent = prevExpenses?.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0) ?? 0
  const prev2TotalSpent = prev2Expenses?.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0) ?? 0
  const income = profile?.income ?? 0
  const savingGoal = profile?.saving_goal ?? 0
  const savedAmount = income > 0 ? Math.max(0, income - totalSpent) : 0
  const savingPct = savingGoal > 0 ? Math.min(Math.round((savedAmount / savingGoal) * 100), 100) : 0
  const spendingDiff = prevTotalSpent > 0 ? Math.round(((totalSpent - prevTotalSpent) / prevTotalSpent) * 100) : null

  // 유저 커스텀 카테고리, 없으면 expenses/budgets에서 동적 수집
  const userCatNames = (categoriesData ?? []).map((c: any) => c.name)
  const expenseCatNames = [...new Set([
    ...(expenses ?? []).filter(e => e.type === 'expense').map(e => e.category),
    ...(prevExpenses ?? []).filter((e: any) => e.type === 'expense').map((e: any) => e.category),
    ...(budgets ?? []).map((b: any) => b.category),
  ])]
  const reportCategories = userCatNames.length > 0 ? userCatNames : expenseCatNames

  const catData = reportCategories.map((cat: string) => {
    const amount = expenses?.filter(e => e.category === cat && e.type === 'expense').reduce((s, e) => s + e.amount, 0) ?? 0
    const prevAmount = prevExpenses?.filter((e: any) => e.category === cat).reduce((s: number, e: any) => s + e.amount, 0) ?? 0
    const budget = budgets?.find(b => b.category === cat)?.amount ?? 0
    const budgetPct = budget > 0 ? Math.min(Math.round((amount / budget) * 100), 100) : 0
    const prevDiff = prevAmount > 0 ? Math.round(((amount - prevAmount) / prevAmount) * 100) : null
    return { cat, amount, prevAmount, budget, budgetPct, prevDiff }
  })

  const threeMonths = [
    { month: prev2Month, label: dayjs(prev2Month).format('M\uC6D4'), total: prev2TotalSpent },
    { month: prevMonth, label: dayjs(prevMonth).format('M\uC6D4'), total: prevTotalSpent },
    { month: safeMonth, label: dayjs(safeMonth).format('M\uC6D4'), total: totalSpent },
  ]
  const maxTotal = Math.max(...threeMonths.map(m => m.total), 1)

  let patternComment = ''
  if (prevTotalSpent > 0 && prev2TotalSpent > 0) {
    if (totalSpent < prevTotalSpent && prevTotalSpent < prev2TotalSpent) {
      patternComment = '3\uAC1C\uC6D4 \uC5F0\uC18D \uC904\uC774\uACE0 \uC788\uC5B4\uC694! \uC798\uD558\uACE0 \uC788\uC5B4\uC694 \uD83C\uDF3F'
    } else if (totalSpent > prevTotalSpent && prevTotalSpent > prev2TotalSpent) {
      patternComment = '3\uAC1C\uC6D4\uC9F8 \uB298\uACE0 \uC788\uC5B4\uC694. \uD55C\uBC88 \uC810\uAC80\uD574\uBCFC\uAE4C\uC694?'
    } else {
      patternComment = '\uB4E4\uCABD\uB0A0\uCABD\uD55C \uD328\uD134\uC774\uC5D0\uC694. \uACE0\uC815 \uC608\uC0B0\uC744 \uC7A1\uC544\uBCF4\uB294 \uAC74 \uC5B4\uB5A8\uAE4C\uC694?'
    }
  }

  return (
    <ReportClient
      userId={user.id}
      currentMonth={safeMonth}
      prevMonth={prevMonth}
      maxMonth={maxMonth}
      totalSpent={totalSpent}
      prevTotalSpent={prevTotalSpent}
      spendingDiff={spendingDiff}
      savingGoal={savingGoal}
      savedAmount={savedAmount}
      savingPct={savingPct}
      catData={catData}
      threeMonths={prevTotalSpent > 0 ? threeMonths : null}
      maxTotal={maxTotal}
      patternComment={patternComment}
      cachedCoach={cachedReport?.ai_coach ?? null}
      hasEnoughData={prevTotalSpent > 0}
    />
  )
}
