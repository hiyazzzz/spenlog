import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BudgetForm from '@/components/budget/BudgetForm'
import dayjs from 'dayjs'

export default async function BudgetPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const thisMonth = dayjs().format('YYYY-MM')

  const [{ data: budgets }, { data: expenses }, { data: profile }] = await Promise.all([
    supabase.from('budgets').select('*').eq('user_id', user.id).eq('month', thisMonth),
    supabase.from('expenses').select('category, amount').eq('user_id', user.id)
      .gte('date', `${thisMonth}-01`)
      .lt('date', `${dayjs().add(1, 'month').format('YYYY-MM')}-01`),
    supabase.from('users').select('income').eq('id', user.id).single(),
  ])

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
      />
    </div>
  )
}
