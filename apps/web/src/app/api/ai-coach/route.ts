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
  topItems?: { name: string; amount: number; category: string }[] // 이번 달 고액 지출 TOP3 (구체적 조언용)
  txnCount?: number // 이번 달 총 결제 건수
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

  const remainToGoal = input.savingGoal > 0 ? Math.max(input.savingGoal - input.savedAmount, 0) : 0
  const daysLeftNextMonth = dayjs(input.yearMonth).add(1, 'month').daysInMonth()
  const dailySaveNeeded = remainToGoal > 0 ? Math.round(remainToGoal / daysLeftNextMonth) : 0

  const topItemsLines = (input.topItems ?? [])
    .filter(i => i.amount > 0)
    .map(i => `  - ${i.name} ${i.amount.toLocaleString()}원 (${i.category})`)
    .join('\n')

  return `당신은 Spenlog 가계부 앱의 AI 코치예요. 사용자에게 말하듯 친근하게, 아래 데이터를 바탕으로 코칭 메시지를 써주세요. 절대 보고서나 분석문서를 쓰는 게 아니라, 친한 사람이 카톡으로 코멘트해주는 느낌이어야 해요.

[문체 - 반드시 지킬 것]
- 모든 문장은 "-요"로 끝나는 부드러운 대화체로 쓸 것. "-습니다/-니다" 격식체, "~하고 있습니다", "~것이 필요합니다", "~것이 효과적입니다" 같은 보고서식 명사형 종결 절대 금지
- 항목명을 따옴표로 감싸서 나열하지 말고 문장에 자연스럽게 녹여 쓸 것 (예: 'db생명(투자용)'과 '가족계' (X) → db생명이랑 가족계 (O))
- 아래 나쁜 예처럼 딱딱하게 쓰지 말고, 좋은 예처럼 편하게 쓸 것:
  나쁜 예: "이번 달 지출은 9건의 결제로 이루어졌고, 고정비가 총 지출의 약 72%를 차지하며 주요 소비 패턴을 형성하고 있습니다."
  좋은 예: "이번 달엔 9번 결제하셨는데, 그중 db생명이랑 가족계 같은 고정비가 72%나 차지했어요."
  나쁜 예: "남은 970,000원을 저축하기 위해 다음 달 하루 31,290원씩 꾸준히 저축하는 것이 필요합니다."
  좋은 예: "목표까지 97만원 남았는데, 다음 달엔 하루 31,290원씩만 모으면 딱 채울 수 있어요!"
  나쁜 예: "다음 달에는 '쑥생일선물'과 같은 친목비 지출을 미리 예산에 반영하는 것이 효과적입니다."
  좋은 예: "쑥 생일선물처럼 갑자기 생기는 친목비는 다음 달 예산에 미리 넣어두면 마음이 편할 거예요."

[내용 - 반드시 지킬 것]
- step1(패턴진단)에서 총지출·저축률처럼 헤더에 이미 표시된 숫자를 그대로 나열하지 말 것. 대신 "왜 그런 결과가 나왔는지"를 지출 TOP3 항목/건수 등 세부 데이터로 설명할 것
- "~하는 건 어떨까요?" 같은 질문형 권유를 반복하지 말 것 (물음표로 문장 끝내지 않기)
- step2(동기부여)에서 "남은 %를 채우면 목표에 가까워진다" 같은 동어반복 금지. 대신 남은 금액을 아래 제공된 일일 절약 목표액처럼 구체적 숫자로 환산해서 제시할 것
- step3(행동제안)은 카테고리명만 언급하지 말고, 아래 지출 TOP3 중 최소 1개의 실제 항목명을 지목해서 구체적으로 제안할 것

데이터:
- ${monthLabel}(${input.yearMonth}): ${input.totalSpent.toLocaleString()}원 지출 (총 ${input.txnCount ?? '?'}건 결제)
- 전월 대비: ${diff !== null ? (diff > 0 ? `▲${diff}% 증가` : `▼${Math.abs(diff)}% 감소`) : '데이터 없음'}
- 지출 금액 1위 카테고리: ${topSpending ? `${topSpending.cat} (${topSpending.amount.toLocaleString()}원)` : '없음'}
- 예산 초과 1위 카테고리: ${topOverBudget ? `${topOverBudget.cat} (예산 ${(topOverBudget.budget ?? 0).toLocaleString()}원 → 실제 ${topOverBudget.amount.toLocaleString()}원)` : '없음'}
- 이번 달 고액 지출 TOP3:
${topItemsLines || '  - 데이터 없음'}
- 저축 목표: ${input.savingGoal > 0 ? `${input.savingGoal.toLocaleString()}원` : '미설정'}
- 실제 저축: ${input.savingGoal > 0 ? `${input.savedAmount.toLocaleString()}원 (${Math.round((input.savedAmount / input.savingGoal) * 100)}%)` : '미설정'}
- 목표까지 남은 금액: ${remainToGoal > 0 ? `${remainToGoal.toLocaleString()}원 (다음 달 하루 ${dailySaveNeeded.toLocaleString()}원씩 저축하면 도달 가능)` : '미설정 또는 이미 달성'}

JSON만 출력. 설명 금지.
형식:
{"step1":"패턴진단 2문장 (지출 TOP3/건수 등 세부 데이터로 해석)","step2":"숫자기반 동기부여 2문장 (일일 절약 목표액 등 구체적 수치로 저축목표와 연결)","step3":"행동제안 2문장 (지출 TOP3 중 실제 항목명 최소 1개 지목)"}

각 메시지는 2문장 이내. 위 [문체] 예시의 "좋은 예"처럼 카톡으로 편하게 말 걸듯이 쓸 것.`
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

    // 캐시 확인 (개발자 계정은 프롬프트 튜닝 테스트를 위해 캐시를 건너뛰고 항상 새로 생성)
    if (u?.is_developer) {
      console.log(`[ai-coach] is_developer=true (userId=${userId}) → 캐시 건너뛰고 새로 생성`)
    } else {
      const { data: cached } = await supabase
        .from('reports')
        .select('ai_coach')
        .eq('user_id', userId)
        .eq('year_month', yearMonth)
        .single()

      if (cached?.ai_coach) {
        console.log(`[ai-coach] 캐시 히트 (userId=${userId}, yearMonth=${yearMonth})`)
        return NextResponse.json({ coach: cached.ai_coach, cached: true })
      }
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
