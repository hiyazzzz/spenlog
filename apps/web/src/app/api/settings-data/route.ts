import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const [{ data: profile }, { data: identities }] = await Promise.all([
    supabase.from('users').select('*').eq('id', user.id).single(),
    supabase.auth.getUserIdentities(),
  ])

  const PREMIUM_ONLY_THEMES = ['Lavender', 'Terracotta']
  if (profile?.theme && PREMIUM_ONLY_THEMES.includes(profile.theme)) {
    await supabase.from('users').update({ theme: 'Burgundy' }).eq('id', user.id)
    if (profile) profile.theme = 'Burgundy'
  }

  const hasGoogle = (identities?.identities ?? []).some((i: any) => i.provider === 'google')
  const provider = identities?.identities?.[0]?.provider ?? 'email'
  const isGuest = user.is_anonymous ?? false

  return NextResponse.json({
    profile,
    userId: user.id,
    email: user.email ?? '',
    provider,
    isGuest,
    hasGoogle,
  })
}
