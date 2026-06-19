/**
 * 프리미엄 접근 제어 — 단일 진입점
 * 모든 프리미엄 기능 체크는 반드시 이 함수 하나로 통일.
 * 개별 컴포넌트에서 is_premium 직접 체크 금지.
 *
 * 개발 환경 전체 해제 플래그:
 * - web: NEXT_PUBLIC_PREMIUM_BYPASS
 * - mobile: EXPO_PUBLIC_PREMIUM_BYPASS
 */

interface PremiumUser {
  is_premium?: boolean | null
  is_developer?: boolean | null
  premium_expires_at?: string | null
  trial_started_at?: string | null
}

export function isPremiumUnlocked(user: PremiumUser | null): boolean {
  // 개발 환경 전체 해제
  if (
    process.env.NEXT_PUBLIC_PREMIUM_BYPASS === 'true' ||
    process.env.EXPO_PUBLIC_PREMIUM_BYPASS === 'true'
  ) return true
  if (!user) return false
  // 개발자 계정
  if (user.is_developer) return true
  // 유료 프리미엄 (만료일 체크)
  if (user.is_premium && user.premium_expires_at) {
    return new Date(user.premium_expires_at) > new Date()
  }
  // 90일 무료체험
  if (user.trial_started_at) {
    const trialEnd = new Date(user.trial_started_at)
    trialEnd.setDate(trialEnd.getDate() + 90)
    return new Date() < trialEnd
  }
  return false
}
