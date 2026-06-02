import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BudgetForm from '@/components/budget/BudgetForm'

export default async function BudgetPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: budgets } = await supabase
    .from('budgets')
    .select('*')
    .eq('user_id', user.id)

  return (
    <div className="min-h-screen bg-[#FAF7F4] px-4 pt-6 pb-20">
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-[#4A1220] mb-1">예산 설정</h1>
        <p className="text-xs text-gray-400">카테고리별로 이번 달 목표 예산을 정해보세요.</p>
      </div>

      <BudgetForm userId={user.id} initialBudgets={budgets || []} />
    </div>
  )
}