import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import dayjs from 'dayjs'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const thisMonth = dayjs().format('YYYY-MM')
  const nextMonth = dayjs().add(1, 'month').format('YYYY-MM')
  const threeMonthsAgo = dayjs().subtract(2, 'month').format('YYYY-MM')

  const [
    { data: profile },
    { data: accounts },
    { data: cards },
    { data: fixedCosts },
    { data: expenses },
    { data: budgets },
    { data: customCategories },
    { data: recentExpenses },
  ] = await Promise.all([
    supabase.from('users').select('*').eq('id', user.id).single(),
    supabase.from('accounts').select('*').eq('user_id', user.id),
    supabase.from('cards').select('*').eq('user_id', user.id),
    supabase.from('fixed_costs').select('*').eq('user_id', user.id),
    supabase.from('expenses').select('id, name, amount, category, date, payment_method, type')
      .eq('user_id', user.id)
      .gte('date', `${thisMonth}-01`).lt('date', `${nextMonth}-01`)
      .order('date', { ascending: false }),
    supabase.from('budgets').select('*').eq('user_id', user.id).eq('month', thisMonth),
    supabase.from('categories').select('*').eq('user_id', user.id).order('sort_order'),
    supabase.from('expenses').select('category, amount, date')
      .eq('user_id', user.id).neq('type', 'transfer')
      .gte('date', `${threeMonthsAgo}-01`).lt('date', `${nextMonth}-01`),
  ])

  // Budget carryover: 이번 달 예산 없으면 가장 최근 이전 달에서 복사 (persist)
  let resolvedBudgets: any[] = budgets ?? []
  if (resolvedBudgets.length === 0) {
    const { data: prevBudgets } = await supabase
      .from('budgets')
      .select('category, amount, month')
      .eq('user_id', user.id)
      .lt('month', thisMonth)
      .order('month', { ascending: false })
      .limit(50)

    if (prevBudgets && prevBudgets.length > 0) {
      const latestMonth = (prevBudgets[0] as any).month as string
      const latestRows = prevBudgets.filter((b: any) => b.month === latestMonth)

      const newBudgets = latestRows.map((b: any) => ({
        user_id: user.id,
        category: b.category as string,
        amount: b.amount as number,
        month: thisMonth,
        source: 'manual',
      }))

      await supabase
        .from('budgets')
        .upsert(newBudgets, { onConflict: 'user_id,category,month', ignoreDuplicates: true })

      resolvedBudgets = newBudgets
    }
  }

  const categorySpent: Record<string, number> = {}
  expenses?.forEach(e => {
    if (!e.type || e.type === 'expense') {
      categorySpent[e.category] = (categorySpent[e.category] ?? 0) + e.amount
    }
  })

  return NextResponse.json({
    profile: profile ?? null,
    accounts: accounts ?? [],
    cards: cards ?? [],
    fixedCosts: fixedCosts ?? [],
    budgets: resolvedBudgets,
    thisMonthSpent: expenses?.filter(e => !e.type || e.type === 'expense').reduce((s, e) => s + e.amount, 0) ?? 0,
    categorySpent,
    thisMonth,
    customCategories: customCategories ?? [],
    expenses: expenses ?? [],
    recentExpenses: recentExpenses ?? [],
  })
}
