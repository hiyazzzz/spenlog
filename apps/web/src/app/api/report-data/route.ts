import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import dayjs from 'dayjs'
import 'dayjs/locale/ko'

dayjs.locale('ko')

// 이름이 비슷한 소액 지출(커피, 배달 등)을 묶어서 합산 - 개별 금액은 작아도 모이면 유의미한 지출 유형
const SPEND_CLUSTER_KEYWORDS: Record<string, string[]> = {
  '카페/커피': ['커피', '카페', '스타벅스', '스벅', '이디야', '투썸', '커피빈', '빽다방', '메가커피', '컴포즈', '아메리카노', '라떼'],
  '배달/외식': ['배달', '배민', '요기요', '쿠팡이츠', '맥도날드', '버거킹', '치킨', '피자'],
  '편의점': ['cu', 'gs25', '세븐일레븐', '이마트24', '편의점'],
  '온라인쇼핑': ['쿠팡', '무신사', '지마켓', '11번가', '올리브영'],
  '구독서비스': ['넷플릭스', '왓챠', '유튜브', '멜론', '스포티파이', '디즈니'],
}

function clusterExpenses(items: { name: string; amount: number }[]): { label: string; amount: number; count: number }[] {
  const result: { label: string; amount: number; count: number }[] = []
  for (const [label, keywords] of Object.entries(SPEND_CLUSTER_KEYWORDS)) {
    const matched = items.filter(i => keywords.some(k => i.name.toLowerCase().includes(k.toLowerCase())))
    if (matched.length >= 2) {
      result.push({ label, amount: matched.reduce((s, i) => s + i.amount, 0), count: matched.length })
    }
  }
  return result.sort((a, b) => b.amount - a.amount)
}

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

  const isExpense = (e: any) => (e.type ?? (e.category === '수입' ? 'income' : 'expense')) === 'expense'
  const totalSpent = expenses?.filter(isExpense).reduce((s, e) => s + e.amount, 0) ?? 0
  const prevTotalSpent = prevExpenses?.filter(isExpense).reduce((s, e) => s + e.amount, 0) ?? 0
  const prev2TotalSpent = prev2Expenses?.filter(isExpense).reduce((s, e) => s + e.amount, 0) ?? 0
  const savingGoal = profile?.saving_goal ?? 0
  const income = profile?.income ?? 0
  // 실제 저축 기록 합산 (홈화면과 동일 기준)
  const savedAmount = expenses?.filter((e: any) => e.type === 'savings').reduce((s: number, e: any) => s + e.amount, 0) ?? 0
  const savingPct = savingGoal > 0 ? Math.min(Math.round((savedAmount / savingGoal) * 100), 100) : 0
  const spendingDiff = prevTotalSpent > 0 ? Math.round(((totalSpent - prevTotalSpent) / prevTotalSpent) * 100) : null

  const normCat = (cat: string | null | undefined): string => cat || '기타'
  const userCatNames = (categoriesData ?? []).map((c: any) => c.name)
  const isExp = (e: any) => (e.type ?? 'expense') === 'expense'
  const expenseCatNames = [...new Set([
    ...(expenses ?? []).filter(isExp).map((e: any) => normCat(e.category)),
    ...(prevExpenses ?? []).filter(isExp).map((e: any) => normCat(e.category)),
    ...(budgets ?? []).map((b: any) => b.category),
  ])]
  const baseCats = userCatNames.length > 0 ? userCatNames : expenseCatNames
  const hasUncategorized = [...(expenses ?? []), ...(prevExpenses ?? [])].some((e: any) => isExp(e) && !e.category)
  const reportCategories = hasUncategorized && !baseCats.includes('기타') ? [...baseCats, '기타'] : baseCats

  const catData = reportCategories.map((cat: string) => {
    const amount = expenses?.filter((e: any) => normCat(e.category) === cat && isExp(e)).reduce((s: number, e: any) => s + e.amount, 0) ?? 0
    const prevAmount = prevExpenses?.filter((e: any) => normCat(e.category) === cat && isExp(e)).reduce((s: number, e: any) => s + e.amount, 0) ?? 0
    const budget = budgets?.find((b: any) => b.category === cat)?.amount ?? 0
    const budgetPct = budget > 0 ? Math.min(Math.round((amount / budget) * 100), 100) : 0
    const prevDiff = prevAmount > 0 ? Math.round(((amount - prevAmount) / prevAmount) * 100) : null
    return { cat, amount, prevAmount, budget, budgetPct, prevDiff }
  })

  const topCategory = catData.filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount)[0]?.cat ?? null

  const daysInMonth = dayjs(safeMonth).daysInMonth()
  const dailyMap = new Map<number, number>()
  expenses?.filter(isExpense).forEach((e: any) => {
    const day = dayjs(e.date).date()
    dailyMap.set(day, (dailyMap.get(day) ?? 0) + e.amount)
  })
  const dailyData = Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1, amount: dailyMap.get(i + 1) ?? 0 }))

  const spendDaysSet = new Set(expenses?.filter(isExpense).map((e: any) => dayjs(e.date).date()))
  const noSpendDays = daysInMonth - spendDaysSet.size

  // AI 코치가 "고정비를 줄여보세요" 같은 뭉뚱그린 조언 대신 실제 항목을 지목할 수 있도록 고액 지출 TOP3 전달
  const expenseRows = (expenses ?? []).filter(isExp)
  const topItems = [...expenseRows]
    .sort((a: any, b: any) => b.amount - a.amount)
    .slice(0, 3)
    .map((e: any) => ({ name: e.name ?? '항목', amount: e.amount, category: normCat(e.category) }))
  const txnCount = expenseRows.length
  const spendClusters = clusterExpenses(expenseRows.map((e: any) => ({ name: e.name ?? '', amount: e.amount })))

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
    income,
    catData,
    topCategory,
    dailyData,
    noSpendDays,
    topItems,
    txnCount,
    spendClusters,
    threeMonths: prevTotalSpent > 0 ? threeMonths : null,
    maxTotal,
    patternComment,
    // 개발자 계정은 화면에 캐시된 코치 문구를 바로 채우지 않음 - 항상 버튼을 눌러 새로 생성하도록 유도
    cachedCoach: profile?.is_developer ? null : (cachedReport?.ai_coach ?? null),
    hasEnoughData: prevTotalSpent > 0,
  })
}
