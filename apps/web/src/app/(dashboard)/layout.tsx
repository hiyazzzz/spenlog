import React from 'react'
import { createClient } from '@/lib/supabase/server'
import BottomNav from '@/components/ui/BottomNav'
import ThemeProvider from '@/components/ui/ThemeProvider'
import GuideOverlay from '@/components/onboarding/GuideOverlay'
import OfflineBanner from '@/components/ui/OfflineBanner'
import HomeFAB from '@/components/dashboard/HomeFAB'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let theme = 'Burgundy'
  let guideCompleted = true
  let userId = ''

  if (user) {
    const { data: profile } = await supabase
      .from('users').select('theme, guide_completed').eq('id', user.id).single()
    theme = profile?.theme ?? 'Burgundy'
    guideCompleted = profile?.guide_completed ?? false
    userId = user.id
  }

  return (
    <div className="min-h-screen flex flex-col justify-between" style={{ background: 'var(--color-bg)' }}>
      <ThemeProvider theme={theme} />
      <main className="flex-1 w-full max-w-md mx-auto px-4 pt-14 pb-24">
        {children}
      </main>
      <BottomNav />
      <OfflineBanner />
      <HomeFAB />
      {!guideCompleted && userId && (
        <GuideOverlay userId={userId} />
      )}
    </div>
  )
}
