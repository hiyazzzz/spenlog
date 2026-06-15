// 웹 앱 화면을 모바일에서 그대로 보여주기 위한 목업 데이터
// 추후 Supabase 연동 시 이 파일의 형태를 참고해 실제 데이터로 교체

export type MockExpense = {
  id: string
  name: string
  amount: number
  category: string
  date: string
  payment_method: string | null
  type: 'expense' | 'income'
}

export const MOCK_EXPENSES: MockExpense[] = [
  { id: '1', name: '스타벅스', amount: 6000, category: '활동비', date: '2026-06-11', payment_method: '신한카드', type: 'expense' },
  { id: '2', name: '점심 식사', amount: 12000, category: '생활비', date: '2026-06-11', payment_method: '국민카드', type: 'expense' },
  { id: '3', name: '넷플릭스', amount: 17000, category: '고정비', date: '2026-06-10', payment_method: '신한카드', type: 'expense' },
  { id: '4', name: '친구 생일선물', amount: 35000, category: '친목비', date: '2026-06-09', payment_method: '현금', type: 'expense' },
  { id: '5', name: '지하철', amount: 1500, category: '생활비', date: '2026-06-09', payment_method: '교통카드', type: 'expense' },
]

export const MOCK_CATEGORIES = ['생활비', '활동비', '고정비', '친목비']

export const MOCK_BUDGETS: Record<string, number> = {
  생활비: 600000,
  고정비: 350000,
  활동비: 400000,
  친목비: 150000,
}

export const MOCK_ACCOUNTS = [
  { id: 'a1', name: '국민 주거래통장', bank: 'KB국민', balance: 1250000, type: '입출금' },
  { id: 'a2', name: '카카오뱅크 세이프박스', bank: '카카오뱅크', balance: 800000, type: '파킹' },
  { id: 'a3', name: '현금', bank: '현금', balance: 50000, type: '현금' },
]

export const MOCK_CARDS = [
  { id: 'c1', name: '신한카드', bank: '신한', due_day: 15, linked_account: 'a1' },
  { id: 'c2', name: '국민카드', bank: 'KB국민', due_day: 25, linked_account: 'a1' },
]

export const MOCK_FIXED_COSTS = [
  { id: 'f1', name: '넷플릭스', amount: 17000, kind: '고정지출' as const, due_day: 10, type: '월정액' },
  { id: 'f2', name: '월세', amount: 500000, kind: '고정지출' as const, due_day: 25, type: '월정액' },
  { id: 'f3', name: '통신비', amount: 55000, kind: '고정지출' as const, due_day: 27, type: '월정액' },
  { id: 'f4', name: '청약저축', amount: 100000, kind: '고정저축' as const, due_day: 5, type: '월정액' },
  { id: 'f5', name: '비상금 적금', amount: 200000, kind: '고정저축' as const, due_day: 5, type: '월정액' },
]
