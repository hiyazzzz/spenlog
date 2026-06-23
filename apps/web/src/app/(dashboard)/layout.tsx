import React from 'react'
import { createClient } from '@/lib/supabase/server'
import BottomNav from '@/components/ui/BottomNav'
import ThemeProvider from '@/components/ui/ThemeProvider'
import GuideOverlay from '@/components/onboarding/GuideOverlay'
import OfflineBanner from '@/components/ui/OfflineBanner'
import HomeFAB from '@/components/dashboard/HomeFAB'
import EnsureUserRow from '@/components/auth/EnsureUserRow'

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
    userId = user.id
    const { data: profile } = await supabase
      .from('users').select('theme, guide_completed').eq('id', user.id).maybeSingle()
    if (profile) {
      theme = profile.theme ?? 'Burgundy'
      guideCompleted = profile.guide_completed ?? false
    } else {
      // 게스트(익명) 등 public.users 행이 없으면 생성한다.
      // 행이 없으면 expenses/accounts/cards/fixed_costs 등 모든 insert가
      // 외래키 위반(23503, *_user_id_fkey)으로 저장에 실패하기 때문.
      // 익명 유저는 email이 없으므로(users.email NOT NULL) placeholder를 넣는다.
      await supabase.from('users').upsert(
        { id: user.id, email: user.email || `${user.id}@guest.spenlog.app` },
        { onConflict: 'id' }
      )
      guideCompleted = false
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-between" style={{ background: 'var(--color-bg)' }}>
      <ThemeProvider theme={theme} />
      <EnsureUserRow />
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
