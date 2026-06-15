// 웹 앱(apps/web/src/app/globals.css, lib/themes.ts)의 Burgundy 테마를 그대로 이식

import { useEffect, useState } from 'react'
import { getCurrentUserId } from '@/lib/supabase'
import { getProfile } from '@/lib/api/settings'

export const COLORS = {
  primary: '#6B1E2E',
  primaryMid: '#C4748A',
  primaryLight: '#F5E8EA',
  accent: '#4A1220',
  bg: '#FAF7F4',
  surface: '#ffffff',
  border: '#f0f0f0',
  text: '#1a1a1a',
  textSub: '#888888',

  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',

  red: '#ef4444',
  redBg: '#fef2f2',
  green: '#10b981',
  greenBg: '#f0fdf4',
  amber: '#f59e0b',
  amberBg: '#fffbeb',
}

// 카테고리 카드 배경 팔레트 (THEME_CARD_PALETTES.Burgundy)
export const CARD_PALETTE = ['#6B1E2E', '#4A1220', '#8B3D52', '#B06070']

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 18,
  xxl: 20,
}

export const CARD_SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.05,
  shadowRadius: 8,
  elevation: 2,
}

export function formatCurrency(amount: number): string {
  return Math.round(amount).toLocaleString('ko-KR') + '원'
}

// apps/web/src/lib/themes.ts 와 동일 (홈화면 테마 적용용)
export const THEMES: Record<string, { primary: string; primaryLight: string; primaryMid: string; accent: string; bg: string }> = {
  Burgundy: { primary: '#6B1E2E', primaryLight: '#F5E8EA', primaryMid: '#C4748A', accent: '#4A1220', bg: '#FAF7F4' },
  Sage: { primary: '#4A6741', primaryLight: '#EAF0E8', primaryMid: '#8AAF84', accent: '#2E4A2A', bg: '#F5F7F4' },
  Lavender: { primary: '#5C4B8A', primaryLight: '#EDE8F5', primaryMid: '#9B8EC4', accent: '#3D2E6B', bg: '#F7F5FB' },
  Terracotta: { primary: '#A0522D', primaryLight: '#F5EDE8', primaryMid: '#C48A6A', accent: '#7A3518', bg: '#FAF5F2' },
  // 프리미엄 테마 (web 쪽 정의가 아직 없어 settings.tsx 프리미엄 스와치 색상을 기준으로 보강)
  Oatmeal: { primary: '#B5A48C', primaryLight: '#F5F0E9', primaryMid: '#D2C4B2', accent: '#8A7860', bg: '#FAF7F3' },
  WarmGray: { primary: '#8C8479', primaryLight: '#F0EDEA', primaryMid: '#B5AEA4', accent: '#635D54', bg: '#FAF9F7' },
  Midnight: { primary: '#2E3A59', primaryLight: '#E8EAF0', primaryMid: '#6B7A9E', accent: '#1B2438', bg: '#F5F6FA' },
  Indigo: { primary: '#4B5DA6', primaryLight: '#ECEEF7', primaryMid: '#8A97CC', accent: '#343F75', bg: '#F6F7FC' },
}

export const THEME_CARD_PALETTES: Record<string, string[]> = {
  Burgundy: ['#6B1E2E', '#4A1220', '#8B3D52', '#B06070'],
  Sage: ['#4A6741', '#2E4A2A', '#6A8F67', '#3D5E3A'],
  Lavender: ['#5C4B8A', '#3D2E6B', '#7A6AAA', '#4A3A78'],
  Terracotta: ['#A0522D', '#7A3518', '#C4784A', '#854520'],
  Oatmeal: ['#B5A48C', '#8A7860', '#C9BBA6', '#DCCFBE'],
  WarmGray: ['#8C8479', '#635D54', '#A6A096', '#BFB9B1'],
  Midnight: ['#2E3A59', '#1B2438', '#4A5878', '#6B7A9E'],
  Indigo: ['#4B5DA6', '#343F75', '#6B7BC0', '#8A97CC'],
}

export function getThemeColors(theme: string | null | undefined) {
  return THEMES[theme ?? 'Burgundy'] ?? THEMES.Burgundy
}

export function getThemeCardPalette(theme: string | null | undefined) {
  return THEME_CARD_PALETTES[theme ?? 'Burgundy'] ?? THEME_CARD_PALETTES.Burgundy
}

// profile.theme을 직접 불러오지 않는 화면(내역/리포트/예산/고정비 등)에서 사용
export function useThemeColors() {
  const [theme, setTheme] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    let active = true
    ;(async () => {
      const uid = await getCurrentUserId()
      if (!uid) return
      const profile = await getProfile(uid)
      if (active) setTheme(profile?.theme)
    })()
    return () => { active = false }
  }, [])

  return { themeColors: getThemeColors(theme), cardPalette: getThemeCardPalette(theme) }
}
