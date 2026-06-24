import { supabase } from '@/lib/supabase'
import type { Expense } from '@spenlog/types'

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

// payment_method 이름으로 accounts에서 계좌 찾아 잔액 조정
async function adjustAccountBalance(userId: string, paymentMethod: string | null, delta: number) {
  if (!paymentMethod) return
  const { data: account } = await supabase
    .from('accounts')
    .select('id, balance')
    .eq('user_id', userId)
    .eq('name', paymentMethod)
    .single()
  if (!account) return
  await supabase.from('accounts')
    .update({ balance: (account.balance ?? 0) + delta })
    .eq('id', account.id)
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
  const result = await supabase.from('expenses').insert(rows)
  if (!result.error) {
    for (const item of items) {
      const delta = item.type === 'income' ? item.amount : -item.amount
      await adjustAccountBalance(userId, item.payment_method, delta)
    }
  }
  return result
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

// expense 삭제 + 계좌 잔액 역복구
// - savings/transfer: 출금계좌(payment_method) +복구, 입금계좌([이체] 메모 파싱) -복구
// - income: 계좌 잔액 -
// - expense: 계좌 잔액 +
export async function deleteExpense(
  expense: Pick<Expense, 'id' | 'type' | 'amount' | 'payment_method' | 'user_id' | 'memo'>,
) {
  const expType = expense.type ?? 'expense'

  if (expType === 'savings' || expType === 'transfer') {
    // 출금계좌 역복구: payment_method → +amount
    await adjustAccountBalance(expense.user_id, expense.payment_method, expense.amount)
    // 입금계좌 역복구: memo에서 "[이체] 계좌명" 파싱 → -amount
    const memoStr = expense.memo ?? ''
    if (memoStr.startsWith('[이체] ')) {
      const targetName = memoStr.slice('[이체] '.length).split(' · ')[0].trim()
      if (targetName) {
        await adjustAccountBalance(expense.user_id, targetName, -expense.amount)
      }
    }
  } else {
    const delta = expType === 'income' ? -expense.amount : expense.amount
    await adjustAccountBalance(expense.user_id, expense.payment_method, delta)
  }

  return supabase.from('expenses').delete().eq('id', expense.id)
}
