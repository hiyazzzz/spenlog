import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import dayjs from 'dayjs'
import Link from 'next/link'
import AiInputBox from '@/components/expense/AiInputBox'
import DashboardHeader from '@/components/dashboard/DashboardHeader'
import CategorySummary from '@/components/dashboard/CategorySummary'
import RecentExpenses from '@/components/dashboard/RecentExpenses'

export default async function DashboardHomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const thisMonth = dayjs().format('YYYY-MM')

  const [{ data: profile }, { data: expenses }, { data: budgets }] = await Promise.all([
    supabase.from('users').select('*').eq('id', user.id).single(),
    supabase.from('expenses').select('*').eq('user_id', user.id)
      .gte('date', `${thisMonth}-01`).order('date', { ascending: false }),
    supabase.from('budgets').select('*').eq('user_id', user.id).eq('month', thisMonth),
  ])

  const totalSpent = expenses?.reduce((s, e) => s + e.amount, 0) ?? 0

  return (
    <div className="space-y-5">
      <DashboardHeader
        totalSpent={totalSpent}
        savingGoal={profile?.saving_goal ?? 0}
        income={profile?.income ?? 0}
        userName={profile?.name ?? ''}
        theme={profile?.theme ?? 'Burgundy'}
      />
      <div className="p-5 bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-900">한 줄 기록</h2>
          <Link href="/add"
            className="w-8 h-8 flex items-center justify-center rounded-full text-white text-lg font-bold shadow-sm"
            style={{ background: 'var(--color-primary)' }}>
            +
          </Link>
        </div>
        <AiInputBox userId={user.id} />
      </div>
      <CategorySummary expenses={expenses ?? []} budgets={budgets ?? []} />
      <RecentExpenses expenses={expenses ?? []} />
    </div>
  )
}
