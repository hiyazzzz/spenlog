export const THEMES = {
  Burgundy: {
    name: '버건디',
    primary: '#6B1E2E',
    primaryLight: '#F5E8EA',
    primaryMid: '#C4748A',
    accent: '#4A1220',
    bg: '#FAF7F4',
  },
  Sage: {
    name: '세이지',
    primary: '#4A6741',
    primaryLight: '#EAF0E8',
    primaryMid: '#8AAF84',
    accent: '#2E4A2A',
    bg: '#F5F7F4',
  },
  Lavender: {
    name: '라벤더',
    primary: '#5C4B8A',
    primaryLight: '#EDE8F5',
    primaryMid: '#9B8EC4',
    accent: '#3D2E6B',
    bg: '#F7F5FB',
  },
  Terracotta: {
    name: '테라코타',
    primary: '#A0522D',
    primaryLight: '#F5EDE8',
    primaryMid: '#C48A6A',
    accent: '#7A3518',
    bg: '#FAF5F2',
  },
}

export const CATEGORIES = ['생활비', '활동비', '고정비', '친목비', '예비비'] as const

// 카테고리 카드 4종 팔레트 (테마별 색감 계열)
export const THEME_CARD_PALETTES: Record<string, string[]> = {
  Burgundy:   ['#6B1E2E', '#4A1220', '#8B3D52', '#B06070'],
  Sage:       ['#4A6741', '#2E4A2A', '#6A8F67', '#3D5E3A'],
  Lavender:   ['#5C4B8A', '#3D2E6B', '#7A6AAA', '#4A3A78'],
  Terracotta: ['#A0522D', '#7A3518', '#C4784A', '#854520'],
}
