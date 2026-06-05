import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BudgetForm from '@/components/budget/BudgetForm'
import dayjs from 'dayjs'

export default async function BudgetPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const thisMonth = dayjs().format('YYYY-MM')
  const nextMonth = dayjs().add(1, 'month').format('YYYY-MM')
  const threeMonthsAgo = dayjs().subtract(2, 'month').format('YYYY-MM')

  const [{ data: budgets }, { data: expenses }, { data: profile }, { data: fixedCosts }, { data: recentExpenses }, { data: categories }] = await Promise.all([
    supabase.from('budgets').select('*').eq('user_id', user.id).eq('month', thisMonth),
    supabase.from('expenses').select('category, amount').eq('user_id', user.id)
      .gte('date', `${thisMonth}-01`)
      .lt('date', `${nextMonth}-01`),
    supabase.from('users').select('income').eq('id', user.id).single(),
    supabase.from('fixed_costs').select('amount, kind').eq('user_id', user.id),
    // AI 추천용: 최근 3개월 지출 (transfer 제외)
    supabase.from('expenses').select('category, amount, date').eq('user_id', user.id)
      .neq('type', 'transfer')
      .gte('date', `${threeMonthsAgo}-01`)
      .lt('date', `${nextMonth}-01`),
    // 유저 커스텀 카테고리
    supabase.from('categories').select('name, is_hidden').eq('user_id', user.id).order('sort_order'),
  ])

  const fixedSavings = fixedCosts?.filter(f => f.kind === '고정저축').reduce((s, f) => s + f.amount, 0) ?? 0

  const recentExpensesWithMonth = (recentExpenses ?? []).map(e => ({
    category: e.category,
    amount: e.amount,
    month: (e.date as string).slice(0, 7),
  }))

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--color-bg)' }}>
      <div className="mb-5">
        <h1 className="text-lg font-semibold mb-1" style={{ color: 'var(--color-accent)' }}>예산 설정</h1>
        <p className="text-xs text-gray-400">{dayjs().format('YYYY년 M월')} 카테고리별 목표 예산</p>
      </div>
      <BudgetForm
        userId={user.id}
        initialBudgets={budgets || []}
        expenses={expenses || []}
        thisMonth={thisMonth}
        income={profile?.income ?? 0}
        fixedSavings={fixedSavings}
        recentExpenses={recentExpensesWithMonth}
        customCategories={(categories ?? []).filter(c => !c.is_hidden).map(c => c.name)}
      />
    </div>
  )
}
