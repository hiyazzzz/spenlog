export type Theme = 'Burgundy' | 'Sage' | 'Lavender' | 'Terracotta'
export type Category = '생활비' | '활동비' | '고정비' | '친목비' | '예비비'
export type AccountType = '입출금' | '적금' | '투자' | '기타'
export type FixedCostType = '월정액' | '연정액' | '기타'
export type FixedCostKind = '고정지출' | '고정저축'
export type ExpenseType = 'expense' | 'income'

export interface User {
  id: string
  email: string
  name: string | null
  theme: Theme
  income: number
  saving_goal: number
  created_at: string
  home_cover_url?: string | null
  category_img_url_1?: string | null
  category_img_url_2?: string | null
  category_img_url_3?: string | null
  category_img_url_4?: string | null
  onboarding_completed?: boolean | null
  init_setup_completed?: boolean | null
  asset_setup_completed?: boolean | null
  asset_setup_skipped?: boolean | null
  guide_completed?: boolean | null
  push_enabled?: boolean | null
  push_expense_reminder?: boolean | null
  push_due_date_reminder?: boolean | null
  push_due_date_unprocessed?: boolean | null
  push_report?: boolean | null
  is_premium?: boolean | null
  is_developer?: boolean | null
  premium_status?: string | null
  premium_expires_at?: string | null
  trial_started_at?: string | null
  gif_autoplay?: boolean | null
  greeting_last_ids?: string | null
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
  type: ExpenseType
  created_at: string
}

export interface Budget {
  id: string
  user_id: string
  category: Category
  amount: number
  month: string // 'YYYY-MM'
  source?: string | null
}

export interface FixedCost {
  id: string
  user_id: string
  name: string
  amount: number
  type: FixedCostType
  kind: FixedCostKind
  due_day: number | null
  linked_account_id?: string | null
  linked_target_account_id?: string | null
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
  billing_start_day?: number | null
  linked_account_id?: string | null
}
