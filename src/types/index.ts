export type Theme = 'Burgundy' | 'Sage' | 'Lavender' | 'Terracotta'
export type Category = '생활비' | '활동비' | '고정비' | '친목비' | '예비비'
export type AccountType = '입출금' | '적금' | '투자' | '기타'
export type FixedCostType = '월정액' | '연정액' | '기타'

export interface User {
  id: string
  email: string
  name: string | null
  theme: Theme
  income: number
  saving_goal: number
  created_at: string
}

export interface Expense {
  id: string
  user_id: string
  name: string
  amount: number
  category: Category
  date: string
  payment_method: string | null
  memo: string | null
  created_at: string
}

export interface Budget {
  id: string
  user_id: string
  category: Category
  amount: number
  month: string // 'YYYY-MM'
}

export interface FixedCost {
  id: string
  user_id: string
  name: string
  amount: number
  type: FixedCostType
  due_day: number | null
}

export interface Account {
  id: string
  user_id: string
  name: string
  bank: string
  balance: number
  type: AccountType
}

export interface Card {
  id: string
  user_id: string
  name: string
  bank: string
  linked_account: string | null
  due_day: number | null
  limit_amount: number | null
}