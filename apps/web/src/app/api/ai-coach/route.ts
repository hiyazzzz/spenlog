import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface CoachInput {
  yearMonth: string
  totalSpent: number
  prevTotalSpent: number
  savingGoal: number
  savedAmount: number
  catData: { cat: string; amount: number; prevAmount: number }[]
  userId?: string // 모바일 앱은 쿠키 세션이 없어 직접 전달
}

async function generateCoach(input: CoachInput): Promise<{ step1: string; step2: string; step3: string }> {
  const topIncrease = [...input.catData]
    .filter(c => c.prevAmount > 0)
    .sort((a, b) => (b.amount - b.prevAmount) / b.prevAmount - (a.amount - a.prevAmount) / a.prevAmount)[0]

  const diff = input.prevTotalSpent > 0
    ? Math.round(((input.totalSpent - input.prevTotalSpent) / input.prevTotalSpent) * 100)
    : null

  const prompt = `당신은 친근한 한국어 가계부 AI 코치예요. 아래 데이터를 바탕으로 3단계 코칭 메시지를 JSON으로 작성해주세요.

데이터:
- 이번 달(${input.yearMonth}): ${input.totalSpent.toLocaleString()}원 지출
- 전월 대비: ${diff !== null ? (diff > 0 ? `▲${diff}% 증가` : `▼${Math.abs(diff)}% 감소`) : '데이터 없음'}
- 가장 많이 증가한 카테고리: ${topIncrease ? `${topIncrease.cat} (${topIncrease.prevAmount.toLocaleString()}원 → ${topIncrease.amount.toLocaleString()}원)` : '없음'}
- 저축 목표: ${input.savingGoal > 0 ? `${input.savingGoal.toLocaleString()}원` : '미설정'}
- 실제 저축: ${input.savingGoal > 0 ? `${input.savedAmount.toLocaleString()}원 (${Math.round((input.savedAmount / input.savingGoal) * 100)}%)` : '미설정'}

JSON만 출력. 설명 금지.
형식:
{"step1":"패턴진단 2문장 (구체적 수치 포함)","step2":"숫자기반 동기부여 2문장 (저축목표와 연결)","step3":"행동제안 2문장 (실용적이고 구체적)"}

각 메시지는 2문장 이내, 따뜻하고 친근한 말투로.`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 400, temperature: 0.7 },
      }),
    }
  )

  if (!res.ok) throw new Error(`Gemini error ${res.status}`)
  const data = await res.json()
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('JSON not found')
  return JSON.parse(match[0])
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const body: CoachInput = await req.json()
    const { yearMonth } = body
    const userId = user?.id ?? body.userId
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // 캐시 확인
    const { data: cached } = await supabase
      .from('reports')
      .select('ai_coach')
      .eq('user_id', userId)
      .eq('year_month', yearMonth)
      .single()

    if (cached?.ai_coach) {
      return NextResponse.json({ coach: cached.ai_coach, cached: true })
    }

    // 생성
    const coach = await generateCoach(body)

    // 저장 (upsert)
    await supabase.from('reports').upsert({
      user_id: userId,
      year_month: yearMonth,
      total_expense: body.totalSpent,
      ai_coach: coach,
      generated_at: new Date().toISOString(),
    })

    return NextResponse.json({ coach, cached: false })
  } catch (e: any) {
    console.error('[ai-coach]', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
