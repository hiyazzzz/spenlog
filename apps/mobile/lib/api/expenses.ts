import { supabase } from '@/lib/supabase'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://spenlog.vercel.app'

export interface AiParsedItem {
  name: string
  amount: number
  category: string
  date: string
  payment_method: string | null
  type: 'expense' | 'income'
  memo: string | null
}

export interface AiParseResult {
  items?: AiParsedItem[]
  error?: string
}

export async function parseAiInput(text: string): Promise<AiParseResult> {
  try {
    const res = await fetch(`${API_URL}/api/ai-input`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    return await res.json()
  } catch {
    return { error: 'NETWORK_ERROR' }
  }
}

export async function addExpenses(userId: string, items: AiParsedItem[]) {
  const rows = items.map(p => ({
    user_id: userId,
    name: p.name,
    amount: p.amount,
    category: p.category,
    date: p.date,
    payment_method: p.payment_method,
    memo: p.memo,
    type: p.type,
    source: 'ai_input',
  }))
  return supabase.from('expenses').insert(rows)
}

export async function addExpense(userId: string, expense: {
  name: string
  amount: number
  category: string
  date: string
  payment_method?: string | null
  memo?: string | null
  type?: 'expense' | 'income'
}) {
  return supabase.from('expenses').insert({
    user_id: userId,
    name: expense.name,
    amount: expense.amount,
    category: expense.category,
    date: expense.date,
    payment_method: expense.payment_method ?? null,
    memo: expense.memo ?? null,
    type: expense.type ?? 'expense',
    source: 'manual',
  })
}

export async function deleteExpense(id: string) {
  return supabase.from('expenses').delete().eq('id', id)
}
