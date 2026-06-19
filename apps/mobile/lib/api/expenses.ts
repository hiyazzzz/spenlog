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

const AI_ERROR_MESSAGES: Record<string, string> = {
  EMPTY_INPUT: '입력 내용이 없어요',
  AI_UNAVAILABLE: 'AI 서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요',
  PARSE_FAILED: '금액을 인식하지 못했어요. 예) 아아 3000원 / 커피 삼천원',
  NETWORK_ERROR: '네트워크 오류가 발생했어요. 인터넷 연결을 확인해주세요',
}

export async function parseAiInput(text: string): Promise<AiParseResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  try {
    const res = await fetch(`${API_URL}/api/ai-input`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    })
    const data = await res.json()
    if (!res.ok) {
      const code = data?.error ?? 'NETWORK_ERROR'
      return { error: AI_ERROR_MESSAGES[code] ?? code }
    }
    return data
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      return { error: 'AI 응답이 너무 오래 걸려요. 잠시 후 다시 시도해주세요' }
    }
    return { error: AI_ERROR_MESSAGES.NETWORK_ERROR }
  } finally {
    clearTimeout(timer)
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
