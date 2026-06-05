import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import dayjs from 'dayjs'
import AssetsClient from '@/components/assets/AssetsClient'

export default async function AssetsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const thisMonth = dayjs().format('YYYY-MM')
  const nextMonth = dayjs().add(1, 'month').format('YYYY-MM')

  const [
    { data: profile },
    { data: accounts },
    { data: cards },
    { data: fixedCosts },
    { data: expenses },
    { data: budgets },
    { data: customCategories },
  ] = await Promise.all([
    supabase.from('users').select('*').eq('id', user.id).single(),
    supabase.from('accounts').select('*').eq('user_id', user.id),
    supabase.from('cards').select('*').eq('user_id', user.id),
    supabase.from('fixed_costs').select('*').eq('user_id', user.id),
    supabase.from('expenses').select('id, name, amount, category, date, payment_method').eq('user_id', user.id)
      .gte('date', `${thisMonth}-01`).lt('date', `${nextMonth}-01`).order('date', { ascending: false }),
    supabase.from('budgets').select('*').eq('user_id', user.id).eq('month', thisMonth),
    supabase.from('categories').select('*').eq('user_id', user.id).order('sort_order'),
  ])

  const categorySpent: Record<string, number> = {}
  expenses?.forEach(e => {
    categorySpent[e.category] = (categorySpent[e.category] ?? 0) + e.amount
  })

  return (
    <AssetsClient
      profile={profile}
      userId={user.id}
      accounts={accounts ?? []}
      cards={cards ?? []}
      fixedCosts={fixedCosts ?? []}
      budgets={budgets ?? []}
      thisMonthSpent={expenses?.reduce((s, e) => s + e.amount, 0) ?? 0}
      categorySpent={categorySpent}
      thisMonth={thisMonth}
      customCategories={customCategories ?? []}
      expenses={expenses ?? []}
    />
  )
}
