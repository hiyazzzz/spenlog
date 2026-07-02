import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { isPremiumUnlocked } from '@/lib/premium'
import dayjs from 'dayjs'

interface CoachInput {
  yearMonth: string
  totalSpent: number
  prevTotalSpent: number
  savingGoal: number
  savedAmount: number
  catData: { cat: string; amount: number; prevAmount: number; budget?: number }[]
  userId?: string // 모바일 앱은 쿠키 세션이 없어 직접 전달
}

// Gemini 모델 우선순위 (stable → preview 순, ai-input과 동일 전략 — 특정 모델이 지원 종료/장애일 때 자동 폴백)
const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-preview-05-20', 'gemini-1.5-flash']

function buildPrompt(input: CoachInput): string {
  // 지출 금액 1위
  const topSpending = [...input.catData]
    .filter(c => c.amount > 0)
    .sort((a, b) => b.amount - a.amount)[0]

  // 예산 초과 1위 (초과 금액 기준)
  const topOverBudget = [...input.catData]
    .filter(c => (c.budget ?? 0) > 0 && c.amount > (c.budget ?? 0))
    .sort((a, b) => (b.amount - (b.budget ?? 0)) - (a.amount - (a.budget ?? 0)))[0]

  const diff = input.prevTotalSpent > 0
    ? Math.round(((input.totalSpent - input.prevTotalSpent) / input.prevTotalSpent) * 100)
    : null

  const monthLabel = dayjs(input.yearMonth).format('M월')

  return `당신은 친근한 한국어 가계부 AI 코치예요. 아래 데이터를 바탕으로 3단계 코칭 메시지를 JSON으로 작성해주세요.

데이터:
- ${monthLabel}(${input.yearMonth}): ${input.totalSpent.toLocaleString()}원 지출
- 전월 대비: ${diff !== null ? (diff > 0 ? `▲${diff}% 증가` : `▼${Math.abs(diff)}% 감소`) : '데이터 없음'}
- 지출 금액 1위 카테고리: ${topSpending ? `${topSpending.cat} (${topSpending.amount.toLocaleString()}원)` : '없음'}
- 예산 초과 1위 카테고리: ${topOverBudget ? `${topOverBudget.cat} (예산 ${(topOverBudget.budget ?? 0).toLocaleString()}원 → 실제 ${topOverBudget.amount.toLocaleString()}원)` : '없음'}
- 저축 목표: ${input.savingGoal > 0 ? `${input.savingGoal.toLocaleString()}원` : '미설정'}
- 실제 저축: ${input.savingGoal > 0 ? `${input.savedAmount.toLocaleString()}원 (${Math.round((input.savedAmount / input.savingGoal) * 100)}%)` : '미설정'}

JSON만 출력. 설명 금지.
형식:
{"step1":"패턴진단 2문장 (구체적 수치 포함)","step2":"숫자기반 동기부여 2문장 (저축목표와 연결)","step3":"행동제안 2문장 (실용적이고 구체적)"}

각 메시지는 2문장 이내, 따뜻하고 친근한 말투로.`
}

// 모델 1개 호출 — 실패 원인을 진단할 수 있도록 상태 코드/응답 본문을 그대로 서버 콘솔에 남긴다
async function callGeminiModel(model: string, prompt: string, apiKey: string, signal: AbortSignal): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 2048, temperature: 0.7, thinkingConfig: { thinkingBudget: 0 } },
      }),
      signal,
    }
  )

  const rawBody = await res.text()

  if (!res.ok) {
    // 구글 API 서버가 반환한 실제 상태 코드 + 상세 에러 데이터를 그대로 로깅
    console.error(`[ai-coach] Gemini ${model} HTTP ${res.status} ${res.statusText}:`, rawBody)
    if (res.status === 429) console.error(`[ai-coach] → 429: 분당/일일 요청 한도 초과 의심 (Rate Limit)`)
    if (res.status === 403) console.error(`[ai-coach] → 403: API 키 권한 또는 결제(Billing) 계정 연동 문제 의심`)
    if (res.status === 404) console.error(`[ai-coach] → 404: 모델명(${model})이 잘못되었거나 지원 종료됨`)
    const err: any = new Error(`GEMINI_HTTP_${res.status}`)
    err.status = res.status
    err.body = rawBody
    throw err
  }

  let data: any
  try {
    data = JSON.parse(rawBody)
  } catch {
    console.error(`[ai-coach] Gemini ${model} 응답이 JSON이 아님:`, rawBody)
    throw new Error('GEMINI_INVALID_JSON')
  }

  const candidate = data?.candidates?.[0]
  const text = candidate?.content?.parts?.[0]?.text?.trim()

  if (!text) {
    // candidates가 비어있는 전형적 원인: 세이프티 필터 차단, 토큰 소진(thinking), 프롬프트 거부 등
    console.error(
      `[ai-coach] Gemini ${model} 빈 응답 — finishReason=${candidate?.finishReason ?? 'N/A'} blockReason=${data?.promptFeedback?.blockReason ?? 'N/A'}`,
      JSON.stringify(data)
    )
    throw new Error('GEMINI_EMPTY_RESPONSE')
  }

  if (candidate?.finishReason === 'MAX_TOKENS') {
    console.error(`[ai-coach] Gemini ${model} MAX_TOKENS 도달 — 응답이 잘렸을 수 있음. raw:`, text)
  }

  return text
}

async function generateCoach(input: CoachInput): Promise<{ step1: string; step2: string; step3: string }> {
  const prompt = buildPrompt(input)

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error('[ai-coach] GEMINI_API_KEY 환경변수가 설정되지 않음 (Vercel 배포 환경변수 확인 필요)')
    throw new Error('GEMINI_API_KEY_MISSING')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 18000)

  let lastError: any = null
  try {
    for (const model of GEMINI_MODELS) {
      try {
        const raw = await callGeminiModel(model, prompt, apiKey, controller.signal)
        const match = raw.match(/\{[\s\S]*\}/)
        if (!match) {
          console.error(`[ai-coach] Gemini ${model} 응답에서 JSON 객체를 찾지 못함. raw:`, raw)
          lastError = new Error('GEMINI_JSON_NOT_FOUND')
          continue
        }
        let parsed: any
        try {
          parsed = JSON.parse(match[0])
        } catch (parseErr: any) {
          console.error(`[ai-coach] Gemini ${model} JSON.parse 실패:`, match[0], parseErr?.message)
          lastError = parseErr
          continue
        }
        if (!parsed.step1 || !parsed.step2 || !parsed.step3) {
          console.error(`[ai-coach] Gemini ${model} 파싱 결과에 step 필드 누락:`, parsed)
          lastError = new Error('GEMINI_MISSING_FIELDS')
          continue
        }
        console.log(`[ai-coach] Gemini ${model} 성공`)
        return parsed
      } catch (modelErr: any) {
        lastError = modelErr
        if (modelErr.name === 'AbortError') {
          console.error(`[ai-coach] Gemini ${model} 타임아웃(18s) 도달`)
          break // 타임아웃이면 다음 모델도 어차피 signal이 abort된 상태라 중단
        }
        continue
      }
    }
  } finally {
    clearTimeout(timer)
  }

  console.error('[ai-coach] 모든 Gemini 모델 시도 실패. 마지막 에러:', lastError?.message, lastError?.body ?? '')
  throw lastError ?? new Error('GEMINI_ALL_MODELS_FAILED')
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const body: CoachInput = await req.json()
    const { yearMonth } = body
    const userId = user?.id ?? body.userId
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // 완료된 달만 코치 생성 가능
    const thisMonth = dayjs().format('YYYY-MM')
    if (yearMonth >= thisMonth) {
      return NextResponse.json({ error: 'MONTH_NOT_COMPLETE' }, { status: 400 })
    }

    // 프리미엄 체크 (NEXT_PUBLIC_PREMIUM_BYPASS=true 시 항상 통과)
    const { data: u } = await supabase.from('users').select('*').eq('id', userId).single()
    if (!isPremiumUnlocked(u)) {
      return NextResponse.json({ error: 'PREMIUM_REQUIRED' }, { status: 403 })
    }

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
    // 프론트에 고정 메시지만 던지지 않고, 서버 콘솔에는 상태코드/응답본문/스택까지 전부 남긴다
    console.error('[ai-coach] 최종 실패:', {
      message: e?.message,
      status: e?.status,
      body: e?.body,
      stack: e?.stack,
    })
    return NextResponse.json({ error: e?.message ?? 'UNKNOWN' }, { status: 500 })
  }
}
