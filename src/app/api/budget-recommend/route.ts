import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface RecentExpense {
  category: string
  amount: number
  month: string
}

interface CurrentBudget {
  category: string
  amount: number
}

interface RecommendInput {
  income: number
  fixedSavings: number
  recentExpenses: RecentExpense[]
  currentBudgets: CurrentBudget[]
}

const CATEGORIES = ['생활비', '활동비', '고정비', '친목비', '예비비']

// 카테고리별 3개월 평균 계산
function calcMonthlyAvg(expenses: RecentExpense[]): Record<string, number> {
  const totals: Record<string, number> = {}
  const months = new Set(expenses.map(e => e.month))
  const monthCount = Math.max(months.size, 1)

  for (const e of expenses) {
    totals[e.category] = (totals[e.category] ?? 0) + e.amount
  }
  return Object.fromEntries(
    Object.entries(totals).map(([cat, total]) => [cat, Math.round(total / monthCount)])
  )
}

async function callGemini(prompt: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 500, temperature: 0.5 },
      }),
    }
  )
  if (!res.ok) throw new Error(`Gemini error ${res.status}`)
  const data = await res.json()
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
}

// 균형 프리셋 fallback
function fallbackAmounts(income: number, fixedSavings: number): Record<string, number> {
  const targetSaving = Math.round(income * 0.25)
  const spendBudget = income - targetSaving
  const dist: Record<string, number> = { 생활비: 0.30, 활동비: 0.25, 고정비: 0.25, 친목비: 0.12, 예비비: 0.08 }
  return Object.fromEntries(CATEGORIES.map(cat => [cat, Math.round(spendBudget * dist[cat])]))
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body: RecommendInput = await req.json()
    const { income, fixedSavings, recentExpenses, currentBudgets } = body

    if (!income || income <= 0) {
      return NextResponse.json({ error: 'NO_INCOME' }, { status: 400 })
    }

    const avgByCategory = calcMonthlyAvg(recentExpenses)
    const spendableBudget = income - fixedSavings
    const hasHistory = recentExpenses.length > 0

    const avgLines = CATEGORIES.map(cat => {
      const avg = avgByCategory[cat] ?? 0
      return `  - ${cat}: 평균 ${avg.toLocaleString('ko-KR')}원/월`
    }).join('\n')

    const prompt = `당신은 한국 가계부 재무 전문가입니다. 사용자의 실제 지출 데이터를 분석해 다음 달 예산을 추천하세요.

[사용자 데이터]
- 월 수입 (세후): ${income.toLocaleString('ko-KR')}원
- 고정저축: ${fixedSavings.toLocaleString('ko-KR')}원/월
- 지출 가능 예산: ${spendableBudget.toLocaleString('ko-KR')}원
- 최근 3개월 카테고리별 평균 지출:
${avgLines}

[추천 조건]
1. 모든 카테고리 합계는 반드시 ${spendableBudget.toLocaleString('ko-KR')}원 이하
2. 각 금액은 1000원 단위로 반올림
3. 최근 지출이 많은 카테고리는 10~20% 줄이도록 제안
4. 고정비는 실제 고정지출에 맞게 설정
5. 예비비는 최소 지출 가능 예산의 5% 이상

JSON만 출력. 설명 없음.
{"생활비":숫자,"활동비":숫자,"고정비":숫자,"친목비":숫자,"예비비":숫자,"reason":"2줄 이내 근거. 구체적 수치 포함."}`

    let amounts: Record<string, number>
    let reason = ''
    let usedFallback = false

    try {
      const raw = await callGemini(prompt)
      const match = raw.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('JSON not found')
      const parsed = JSON.parse(match[0])

      // 합계 검증
      const total = CATEGORIES.reduce((s, c) => s + (parsed[c] ?? 0), 0)
      if (total > spendableBudget * 1.05) throw new Error('Total exceeds budget')

      amounts = Object.fromEntries(CATEGORIES.map(cat => [cat, Math.round((parsed[cat] ?? 0) / 1000) * 1000]))
      reason = parsed.reason ?? ''
    } catch {
      // Gemini 실패 → fallback
      amounts = fallbackAmounts(income, fixedSavings)
      usedFallback = true
    }

    return NextResponse.json({ amounts, reason, usedFallback, hasHistory })
  } catch (e) {
    console.error('[budget-recommend]', e)
    return NextResponse.json({ error: 'API_ERROR' }, { status: 500 })
  }
}
