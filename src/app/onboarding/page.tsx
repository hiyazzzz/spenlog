import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OnboardingForm from '@/components/onboarding/OnboardingForm'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 이미 닉네임 있으면 대시보드로
  const { data: profile } = await supabase
    .from('users')
    .select('name')
    .eq('id', user.id)
    .single()

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
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#6B1E2E', marginBottom: '8px' }}>
          안녕하세요! 👋
        </h1>
        <p style={{ fontSize: '15px', color: '#B8A8AC', lineHeight: 1.6 }}>
          스펜로그에 오신 걸 환영해요.<br />
          어떻게 불러드릴까요?
        </p>
      </div>
      <OnboardingForm userId={user.id} />
    </div>
  )
}
