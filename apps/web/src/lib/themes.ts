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

// 홈 커버 배너 — 커버 이미지 없을 때 테마별 그래디언트 (CSS var 대신 실제 색상값 사용 → 첫 렌더 시 FOUC 방지)
export const THEME_COVER_GRADIENTS: Record<string, string> = {
  Burgundy:   'linear-gradient(135deg, #6B1E2E 0%, #C4748A 100%)',
  Sage:       'linear-gradient(135deg, #4A6741 0%, #8AAF84 100%)',
  Lavender:   'linear-gradient(135deg, #5C4B8A 0%, #9B8EC4 100%)',
  Terracotta: 'linear-gradient(135deg, #A0522D 0%, #C48A6A 100%)',
}
