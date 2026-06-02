import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardHeader from '@/components/dashboard/DashboardHeader'
import CategorySummary from '@/components/dashboard/CategorySummary'
import RecentExpenses from '@/components/dashboard/RecentExpenses'
import AiInputBox from '@/components/expense/AiInputBox'
import dayjs from 'dayjs'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const thisMonth = dayjs().format('YYYY-MM')

  // 이번 달 지출 합계
  const { data: expenses } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', user.id)
    .gte('date', `${thisMonth}-01`)
    .order('date', { ascending: false })

  // 이번 달 예산
  const { data: budgets } = await supabase
    .from('budgets')
    .select('*')
    .eq('user_id', user.id)
    .eq('month', thisMonth)

  // 유저 정보 (목표금액)
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  const totalSpent = expenses?.reduce((sum, e) => sum + e.amount, 0) ?? 0

  return (
    <main>
      <DashboardHeader
        totalSpent={totalSpent}
        savingGoal={profile?.saving_goal ?? 0}
        userName={profile?.name ?? ''}
        theme={profile?.theme ?? 'Burgundy'}
      />
      <AiInputBox userId={user.id} />
      <div className="px-4 mt-5 space-y-5">
        <CategorySummary expenses={expenses ?? []} budgets={budgets ?? []} />
        <RecentExpenses expenses={(expenses ?? []).slice(0, 5)} />
      </div>
    </main>
  )
}