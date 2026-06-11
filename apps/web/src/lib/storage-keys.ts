// 게스트 유저 localStorage 키 상수
// 로그인 유저는 Supabase DB users 테이블 컬럼 사용

export const STORAGE_KEYS = {
  // 온보딩 플래그
  ONBOARDING_COMPLETED: 'spenlog_onboarding_completed',
  INIT_SETUP_COMPLETED: 'spenlog_init_setup_completed',
  ASSET_SETUP_COMPLETED: 'spenlog_asset_setup_completed',
  ASSET_SETUP_SKIPPED: 'spenlog_asset_setup_skipped',
  GUIDE_COMPLETED: 'spenlog_guide_completed',

  // 유저 설정
  THEME: 'spenlog_theme',
  NICKNAME: 'spenlog_nickname',
  MONTHLY_INCOME: 'spenlog_monthly_income',
  SPENDING_GOAL: 'spenlog_spending_goal',
} as const

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS]
