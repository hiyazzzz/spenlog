import AsyncStorage from '@react-native-async-storage/async-storage'
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

const ONBOARDING_KEY = (uid: string) => `onboarding_completed_${uid}`

export async function checkOnboardingStatus(userId: string): Promise<boolean> {
  // AsyncStorage 로컬 플래그 먼저 확인 (DB 컬럼 미적용 시 폴백)
  try {
    const local = await AsyncStorage.getItem(ONBOARDING_KEY(userId))
    if (local === 'true') return true
  } catch {}

  const { data, error } = await supabase.from('users').select('onboarding_completed').eq('id', userId).single()
  if (error) {
    // DB 컬럼 없음 등 에러 시 로컬 플래그 없으면 온보딩 필요로 판단
    return false
  }
  return !!data?.onboarding_completed
}

export async function completeOnboarding(userId: string) {
  // 로컬 플래그 저장 (DB 업데이트 실패 시에도 반복 진입 방지)
  try { await AsyncStorage.setItem(ONBOARDING_KEY(userId), 'true') } catch {}
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
