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

  // DB fallback: 무료 유저가 Lavender/Terracotta 테마를 갖고 있으면 Burgundy로 교정
  const PREMIUM_ONLY_THEMES = ['Lavender', 'Terracotta']
  if (profile?.theme && PREMIUM_ONLY_THEMES.includes(profile.theme)) {
    await supabase.from('users').update({ theme: 'Burgundy' }).eq('id', user.id)
    profile.theme = 'Burgundy'
  }

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
