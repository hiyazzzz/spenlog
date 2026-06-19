import type { createClient } from '@/lib/supabase/client'

type SupabaseClient = ReturnType<typeof createClient>

// GuideOverlay(온보딩 후 자동 코치마크)와 AppGuide(설정 > 앱 가이드 다시보기)가
// 공통으로 사용하는 guide_completed 플래그 업데이트 로직.
export async function markGuideCompleted(supabase: SupabaseClient, userId: string) {
  return supabase.from('users').upsert({ id: userId, guide_completed: true }, { onConflict: 'id' })
}
