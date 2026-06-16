import { supabase } from '@/lib/supabase'
import type { Theme, User } from '@spenlog/types'

export async function getProfile(userId: string): Promise<User | null> {
  const { data } = await supabase.from('users').select('*').eq('id', userId).single()
  return (data as User) ?? null
}

export async function updateTheme(userId: string, theme: Theme) {
  return supabase.from('users').update({ theme }).eq('id', userId)
}

export async function updateName(userId: string, name: string) {
  return supabase.from('users').update({ name }).eq('id', userId)
}

export async function checkOnboardingStatus(userId: string): Promise<boolean> {
  const { data, error } = await supabase.from('users').select('onboarding_completed').eq('id', userId).single()
  if (error) {
    console.log('[checkOnboardingStatus] error:', error)
    return false
  }
  return !!data?.onboarding_completed
}

export async function completeOnboarding(userId: string) {
  return supabase.from('users').update({ onboarding_completed: true }).eq('id', userId)
}

export interface PushSettings {
  push_expense_reminder?: boolean
  push_due_date_reminder?: boolean
  push_due_date_unprocessed?: boolean
  push_report?: boolean
}

export async function updatePushSettings(userId: string, settings: PushSettings) {
  return supabase.from('users').update(settings).eq('id', userId)
}

export async function updateGifAutoplay(userId: string, gifAutoplay: boolean) {
  return supabase.from('users').update({ gif_autoplay: gifAutoplay }).eq('id', userId)
}

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://spenlog.vercel.app'

export async function deleteAccount(userId: string): Promise<{ error?: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) return { error: '인증 정보가 없어요' }

  const res = await fetch(`${API_URL}/api/delete-account`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ userId }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: data.error ?? '탈퇴 처리 중 오류가 발생했어요' }
  }

  return {}
}
