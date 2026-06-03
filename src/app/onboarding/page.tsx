import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OnboardingForm from '@/components/onboarding/OnboardingForm'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users').select('name').eq('id', user.id).single()
  if (profile?.name) redirect('/')

  return (
    <div style={{
      minHeight: '100vh',
      background: '#FAF7F4',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '0 24px',
      maxWidth: '420px',
      margin: '0 auto',
    }}>
      <OnboardingForm userId={user.id} email={user.email ?? ''} />
    </div>
  )
}
