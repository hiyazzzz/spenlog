import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SettingsForm from '@/components/settings/SettingsForm'
import dayjs from 'dayjs'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const thisMonth = dayjs().format('YYYY-MM')
  const nextMonth = dayjs().add(1, 'month').format('YYYY-MM')

  const [{ data: profile }, { data: identities }, { data: budgets }, { data: expenses }] = await Promise.all([
    supabase.from('users').select('*').eq('id', user.id).single(),
    supabase.auth.getUserIdentities(),
    supabase.from('budgets').select('*').eq('user_id', user.id).eq('month', thisMonth),
    supabase.from('expenses').select('category, amount').eq('user_id', user.id)
      .gte('date', `${thisMonth}-01`).lt('date', `${nextMonth}-01`),
  ])

  const provider = identities?.identities?.[0]?.provider ?? 'email'

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--color-bg)' }}>
      <h1 className="text-lg font-semibold mb-5" style={{ color: 'var(--color-accent)' }}>설정</h1>
      <SettingsForm
        profile={profile}
        userId={user.id}
        email={user.email ?? ''}
        provider={provider}
        budgets={budgets ?? []}
        expenses={expenses ?? []}
        thisMonth={thisMonth}
      />
    </div>
  )
}
