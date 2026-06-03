import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import dayjs from 'dayjs'
import AssetsClient from '@/components/assets/AssetsClient'

export default async function AssetsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const thisMonth = dayjs().format('YYYY-MM')

  const [
    { data: profile },
    { data: accounts },
    { data: cards },
    { data: fixedCosts },
    { data: expenses },
  ] = await Promise.all([
    supabase.from('users').select('*').eq('id', user.id).single(),
    supabase.from('accounts').select('*').eq('user_id', user.id),
    supabase.from('cards').select('*').eq('user_id', user.id),
    supabase.from('fixed_costs').select('*').eq('user_id', user.id),
    supabase.from('expenses').select('amount').eq('user_id', user.id)
      .gte('date', `${thisMonth}-01`)
      .lt('date', `${dayjs().add(1, 'month').format('YYYY-MM')}-01`),
  ])

  return (
    <AssetsClient
      profile={profile}
      userId={user.id}
      accounts={accounts ?? []}
      cards={cards ?? []}
      fixedCosts={fixedCosts ?? []}
      thisMonthSpent={expenses?.reduce((s, e) => s + e.amount, 0) ?? 0}
      thisMonth={thisMonth}
    />
  )
}
