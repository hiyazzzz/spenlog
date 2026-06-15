/**
 * 프리미엄 접근 제어 — 단일 진입점
 * 모든 프리미엄 기능 체크는 반드시 이 함수 하나로 통일.
 * 개별 컴포넌트에서 is_premium 직접 체크 금지.
 *
 * 실제 로직은 @spenlog/utils 에 있음 (웹과 공용).
 * 개발 환경 전체 해제: EXPO_PUBLIC_PREMIUM_BYPASS=true
 */
export { isPremiumUnlocked } from '@spenlog/utils'
