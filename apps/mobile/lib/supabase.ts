import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@spenlog/supabase'
import type { SupabaseClient } from '@spenlog/supabase'

const supabaseUrl: string = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
const supabaseAnonKey: string = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''

export const supabase: SupabaseClient = createClient({
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
  options: {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
})

// 구글 로그인 연동 전 임시 테스트용 userId (web의 로그인 계정 id로 교체해서 사용)
const TEST_USER_ID: string | undefined = process.env.EXPO_PUBLIC_TEST_USER_ID

export async function getCurrentUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser()
  console.log('[getCurrentUserId] supabase auth user:', data.user, 'error:', error)
  if (data.user) return data.user.id
  console.log('[getCurrentUserId] no auth session, falling back to TEST_USER_ID:', TEST_USER_ID)
  return TEST_USER_ID ?? null
}
