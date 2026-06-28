export const THEMES = {
  Burgundy: {
    name: '버건디',
    primary: '#6B1E2E',
    primaryLight: '#F8D5DA',
    primaryMid: '#C4748A',
    accent: '#4A1220',
    bg: '#FEF8F9',
  },
  Sage: {
    name: '세이지',
    primary: '#4A6741',
    primaryLight: '#C8E4C4',
    primaryMid: '#8AAF84',
    accent: '#2E4A2A',
    bg: '#F5FAF5',
  },
  Lavender: {
    name: '라벤더',
    primary: '#5C4B8A',
    primaryLight: '#D8D0F4',
    primaryMid: '#9B8EC4',
    accent: '#3D2E6B',
    bg: '#F7F5FB',
  },
  Terracotta: {
    name: '테라코타',
    primary: '#A0522D',
    primaryLight: '#F5D4C0',
    primaryMid: '#C48A6A',
    accent: '#7A3518',
    bg: '#FDF6F3',
  },
  Oatmeal: {
    name: '오트밀',
    primary: '#8C7B6B',
    primaryLight: '#EEE0C8',
    primaryMid: '#BBA898',
    accent: '#6B5A4A',
    bg: '#FCF9F4',
  },
  WarmGray: {
    name: '웹그레이',
    primary: '#7A7068',
    primaryLight: '#E0D8D0',
    primaryMid: '#AEA49A',
    accent: '#5A524A',
    bg: '#F9F5F1',
  },
  WallGray: {
    name: '월그레이',
    primary: '#6B7280',
    primaryLight: '#CCE0EE',
    primaryMid: '#9CA3AF',
    accent: '#4B5563',
    bg: '#F5F7FA',
  },
  Midnight: {
    name: '미드나잇',
    primary: '#1E2A4A',
    primaryLight: '#C0D0F0',
    primaryMid: '#6474A0',
    accent: '#0F1830',
    bg: '#F3F6FC',
  },
  Indigo: {
    name: '인디고',
    primary: '#3730A3',
    primaryLight: '#D0D0F4',
    primaryMid: '#8B87D4',
    accent: '#1E1B7A',
    bg: '#F4F5FC',
  },
}

export const CATEGORIES = ['생활비', '활동비', '고정비', '친목비', '예비비'] as const

// 카테고리 카드 4종 팔레트 (테마별 색감 계열)
export const THEME_CARD_PALETTES: Record<string, string[]> = {
  Burgundy:   ['#6B1E2E', '#4A1220', '#8B3D52', '#B06070'],
  Sage:       ['#4A6741', '#2E4A2A', '#6A8F67', '#3D5E3A'],
  Lavender:   ['#5C4B8A', '#3D2E6B', '#7A6AAA', '#4A3A78'],
  Terracotta: ['#A0522D', '#7A3518', '#C4784A', '#854520'],
  Oatmeal:    ['#8C7B6B', '#6B5A4A', '#A89A8A', '#7A6858'],
  WarmGray:   ['#7A7068', '#5A524A', '#9A9088', '#6A6258'],
  WallGray:   ['#6B7280', '#4B5563', '#8B9AAC', '#5B6878'],
  Midnight:   ['#1E2A4A', '#0F1830', '#3A4E7A', '#2A3A60'],
  Indigo:     ['#3730A3', '#1E1B7A', '#6560C8', '#4A44B8'],
}

// 홈 커버 배너 — 커버 이미지 없을 때 테마별 그래디언트
export const THEME_COVER_GRADIENTS: Record<string, string> = {
  Burgundy:   'linear-gradient(135deg, #6B1E2E 0%, #C4748A 100%)',
  Sage:       'linear-gradient(135deg, #4A6741 0%, #8AAF84 100%)',
  Lavender:   'linear-gradient(135deg, #5C4B8A 0%, #9B8EC4 100%)',
  Terracotta: 'linear-gradient(135deg, #A0522D 0%, #C48A6A 100%)',
  Oatmeal:    'linear-gradient(135deg, #8C7B6B 0%, #BBA898 100%)',
  WarmGray:   'linear-gradient(135deg, #7A7068 0%, #AEA49A 100%)',
  WallGray:   'linear-gradient(135deg, #6B7280 0%, #9CA3AF 100%)',
  Midnight:   'linear-gradient(135deg, #1E2A4A 0%, #6474A0 100%)',
  Indigo:     'linear-gradient(135deg, #3730A3 0%, #8B87D4 100%)',
}
