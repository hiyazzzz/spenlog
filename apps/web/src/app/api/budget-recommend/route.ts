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
  categories?: string[]  // 유저 커스텀 카테고리 (없으면 기본값)
}

const DEFAULT_CATEGORIES = ['생활비', '고정비', '활동비']

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
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
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

// 균형 프리셋 fallback (커스텀 카테고리 지원)
function fallbackAmounts(income: number, fixedSavings: number, categories: string[]): Record<string, number> {
  const targetSaving = Math.round(income * 0.25)
  const spendBudget = income - targetSaving
  const dist: Record<string, number> = { 생활비: 0.40, 고정비: 0.35, 활동비: 0.25 }
  const spendCats = categories.filter(c => c !== '수입')
  // 알려진 카테고리는 dist 비율, 모르는 카테고리는 남은 비율 균등 배분
  const knownRatio = spendCats.filter(c => c in dist).reduce((s, c) => s + dist[c], 0)
  const unknownCats = spendCats.filter(c => !(c in dist))
  const unknownRatio = unknownCats.length > 0 ? Math.max(0, 1 - knownRatio) / unknownCats.length : 0
  return Object.fromEntries(
    spendCats.map(cat => [cat, Math.round(spendBudget * (cat in dist ? dist[cat] : unknownRatio))])
  )
}

export async function POST(req: Request) {
  try {
    const body: RecommendInput = await req.json()
    const { income, fixedSavings, recentExpenses, currentBudgets, categories: reqCategories } = body
    const categories = (reqCategories && reqCategories.length > 0)
      ? reqCategories.filter(c => c !== '수입')
      : DEFAULT_CATEGORIES

    if (!income || income <= 0) {
      return NextResponse.json({ error: 'NO_INCOME' }, { status: 400 })
    }

    const avgByCategory = calcMonthlyAvg(recentExpenses)
    const spendableBudget = income - fixedSavings
    const hasHistory = recentExpenses.length > 0

    const avgLines = categories.map(cat => {
      const avg = avgByCategory[cat] ?? 0
      return `  - ${cat}: 평균 ${avg.toLocaleString('ko-KR')}원/월`
    }).join('\n')

    const categoryList = categories.join('","')
    const jsonTemplate = categories.map(c => `"${c}":숫자`).join(',')
    const prompt = `당신은 한국 가계부 재무 전문가입니다. 사용자의 실제 지출 데이터를 분석해 다음 달 예산을 추천하세요.

[사용자 데이터]
- 월 수입 (세후): ${income.toLocaleString('ko-KR')}원
- 고정저축: ${fixedSavings.toLocaleString('ko-KR')}원/월
- 지출 가능 예산: ${spendableBudget.toLocaleString('ko-KR')}원
- 카테고리: ${categories.join(', ')}
- 최근 3개월 카테고리별 평균 지출:
${avgLines}

[추천 조건]
1. 모든 카테고리 합계는 반드시 ${spendableBudget.toLocaleString('ko-KR')}원 이하
2. 각 금액은 1000원 단위로 반올림
3. 최근 지출이 많은 카테고리는 10~20% 줄이도록 제안
4. 예비비/비상금 성격 카테고리는 최소 지출 가능 예산의 5% 이상
5. 위 카테고리 목록에 있는 항목만 JSON 키로 사용

JSON만 출력. 설명 없음.
{${jsonTemplate},"reason":"2줄 이내 근거. 구체적 수치 포함."}`

    let amounts: Record<string, number>
    let reason = ''
    let usedFallback = false

    try {
      const raw = await callGemini(prompt)
      const match = raw.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('JSON not found')
      const parsed = JSON.parse(match[0])

      // 합계 검증 (커스텀 카테고리 기준)
      const total = categories.reduce((s, c) => s + (parsed[c] ?? 0), 0)
      if (total > spendableBudget * 1.05) throw new Error('Total exceeds budget')

      amounts = Object.fromEntries(categories.map(cat => [cat, Math.round((parsed[cat] ?? 0) / 1000) * 1000]))
      reason = parsed.reason ?? ''
    } catch {
      // Gemini 실패 → fallback (커스텀 카테고리 반영)
      amounts = fallbackAmounts(income, fixedSavings, categories)
      usedFallback = true
    }

    return NextResponse.json({ amounts, reason, usedFallback, hasHistory })
  } catch (e) {
    console.error('[budget-recommend]', e)
    return NextResponse.json({ error: 'API_ERROR' }, { status: 500 })
  }
}
