import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SettingsForm from '@/components/settings/SettingsForm'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: identities }] = await Promise.all([
    supabase.from('users').select('*').eq('id', user.id).single(),
    supabase.auth.getUserIdentities(),
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
      />
    </div>
  )
}
