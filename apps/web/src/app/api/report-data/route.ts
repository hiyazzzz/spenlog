import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import dayjs from 'dayjs'
import 'dayjs/locale/ko'

dayjs.locale('ko')

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const monthParam = searchParams.get('month') ?? ''

  const defaultMonth = dayjs().subtract(1, 'month').format('YYYY-MM')
  const maxMonth = dayjs().subtract(1, 'month').format('YYYY-MM')
  const rawMonth = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : defaultMonth
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

  const totalSpent = expenses?.filter(e => (e.type ?? 'expense') === 'expense').reduce((s, e) => s + e.amount, 0) ?? 0
  const prevTotalSpent = prevExpenses?.filter(e => (e.type ?? 'expense') === 'expense').reduce((s, e) => s + e.amount, 0) ?? 0
  const prev2TotalSpent = prev2Expenses?.filter(e => (e.type ?? 'expense') === 'expense').reduce((s, e) => s + e.amount, 0) ?? 0
  const income = profile?.income ?? 0
  const savingGoal = profile?.saving_goal ?? 0
  const savedAmount = income > 0 ? Math.max(0, income - totalSpent) : 0
  const savingPct = savingGoal > 0 ? Math.min(Math.round((savedAmount / savingGoal) * 100), 100) : 0
  const spendingDiff = prevTotalSpent > 0 ? Math.round(((totalSpent - prevTotalSpent) / prevTotalSpent) * 100) : null

  const userCatNames = (categoriesData ?? []).map((c: any) => c.name)
  const expenseCatNames = [...new Set([
    ...(expenses ?? []).filter(e => (e.type ?? 'expense') === 'expense').map(e => e.category),
    ...(prevExpenses ?? []).filter((e: any) => (e.type ?? 'expense') === 'expense').map((e: any) => e.category),
    ...(budgets ?? []).map((b: any) => b.category),
  ])]
  const reportCategories = userCatNames.length > 0 ? userCatNames : expenseCatNames

  const catData = reportCategories.map((cat: string) => {
    const amount = expenses?.filter(e => e.category === cat && (e.type ?? 'expense') === 'expense').reduce((s, e) => s + e.amount, 0) ?? 0
    const prevAmount = prevExpenses?.filter((e: any) => e.category === cat).reduce((s: number, e: any) => s + e.amount, 0) ?? 0
    const budget = budgets?.find(b => b.category === cat)?.amount ?? 0
    const budgetPct = budget > 0 ? Math.min(Math.round((amount / budget) * 100), 100) : 0
    const prevDiff = prevAmount > 0 ? Math.round(((amount - prevAmount) / prevAmount) * 100) : null
    return { cat, amount, prevAmount, budget, budgetPct, prevDiff }
  })

  const threeMonths = [
    { month: prev2Month, label: dayjs(prev2Month).format('M월'), total: prev2TotalSpent },
    { month: prevMonth, label: dayjs(prevMonth).format('M월'), total: prevTotalSpent },
    { month: safeMonth, label: dayjs(safeMonth).format('M월'), total: totalSpent },
  ]
  const maxTotal = Math.max(...threeMonths.map(m => m.total), 1)

  let patternComment = ''
  if (prevTotalSpent > 0 && prev2TotalSpent > 0) {
    if (totalSpent < prevTotalSpent && prevTotalSpent < prev2TotalSpent) {
      patternComment = '3개월 연속 줄이고 있어요! 잘하고 있어요 🌿'
    } else if (totalSpent > prevTotalSpent && prevTotalSpent > prev2TotalSpent) {
      patternComment = '3개월째 늘고 있어요. 한번 점검해볼까요?'
    } else {
      patternComment = '들쭉날쭉한 패턴이에요. 고정 예산을 잡아보는 건 어떨까요?'
    }
  }

  return NextResponse.json({
    userId: user.id,
    currentMonth: safeMonth,
    prevMonth,
    maxMonth,
    totalSpent,
    prevTotalSpent,
    spendingDiff,
    savingGoal,
    savedAmount,
    savingPct,
    catData,
    threeMonths: prevTotalSpent > 0 ? threeMonths : null,
    maxTotal,
    patternComment,
    cachedCoach: cachedReport?.ai_coach ?? null,
    hasEnoughData: prevTotalSpent > 0,
  })
}
