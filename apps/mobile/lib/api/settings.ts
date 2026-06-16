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
  // 로컬 플래그