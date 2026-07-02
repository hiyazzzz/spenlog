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
  income?: number // 수입 대비 저축률 벤치마크용
  catData: { cat: string; amount: number; prevAmount: number; budget?: number }[]
  topItems?: { name: string; amount: number; category: string }[] // 이번 달 고액 지출 TOP3 (구체적 조언용)
  txnCount?: number // 이번 달 총 결제 건수
  userId?: string // 모바일 앱은 쿠키 세션이 없어 직접 전달
}

// Gemini 모델 우선순위 (stable → preview 순, ai-input과 동일 전략 — 특정 모델이 지원 종료/장애일 때 자동 폴백)
const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-preview-05-20', 'gemini-1.5-flash']

// 일반적으로 권장되는 수입 대비 저축률 가이드라인 (재무 기준 진단용)
const SAVING_RATE_GUIDELINE_PCT = 20

// 이전 코칭 결과(신규 message 스키마 또는 구버전 step1/2/3 스키마 모두)에서 회고용 텍스트를 뽑아냄
function extractCoachText(coach: any): string {
  if (!coach) return ''
  if (typeof coach.message === 'string') return coach.message
  return [coach.step1, coach.step2, coach.step3].filter(Boolean).join(' ')
}

function buildPrompt(input: CoachInput, lastMonthCoachText: string): string {
  // 지출 금액 1위
  const topSpending = [...input.catData]
    .filter(c => c.amount > 0)
    .sort((a, b) => b.amount - a.amount)[0]

  // 예산 초과 1위 (초과 금액 기준)
  const topOverBudget = [...input.catData]
    .filter(c => (c.budget ?? 0) > 0 && c.amount > (c.budget ?? 0))
    .sort((a, b) => (b.amount - (b.budget ?? 0)) - (a.amount - (a.budget ?? 0)))[0]

  // 절감 여지 카테고리: 예산 초과가 있으면 우선, 없으면 전달 대비 가장 많이 늘어난 곳
  const topIncrease = [...input.catData]
    .filter(c => c.prevAmount > 0 && c.amount > c.prevAmount)
    .sort((a, b) => (b.amount - b.prevAmount) - (a.amount - a.prevAmount))[0]
  const overspendLine = topOverBudget
    ? `${topOverBudget.cat} - 예산 ${(topOverBudget.budget ?? 0).toLocaleString()}원 대비 ${(topOverBudget.amount - (topOverBudget.budget ?? 0)).toLocaleString()}원 초과`
    : topIncrease
      ? `${topIncrease.cat} - 전달보다 ${(topIncrease.amount - topIncrease.prevAmount).toLocaleString()}원 증가`
      : '뚜렷하게 과다 지출된 카테고리 없음'

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

  const savingsRatePct = input.income && input.income > 0
    ? Math.round((input.savedAmount / input.income) * 100)
    : null

  return `당신은 Spenlog 가계부 앱의 유료 AI 재무 코치예요. 사용자에게 말하듯 친근하게, 아래 데이터를 바탕으로 코칭 메시지 하나를 써주세요. 절대 딱딱한 보고서가 아니라, 친한 재무 코치가 카톡으로 메시지 보내주는 느낌이어야 해요. "1번은 이거, 2번은 저거" 식으로 나누지 말고 인사 없이 바로 본론부터 자연스럽게 이어지는 글로 쓸 것.

[포맷 - 반드시 지킬 것]
- [소비 요약], [행동 가이드] 같은 인위적인 대제목을 절대 쓰지 말 것
- 대신 내용 흐름이 바뀌는 지점마다 문단을 나누고, 문단 사이는 줄바꿈 두 번(\\n\\n)으로 구분할 것. 전체 2~4문단
- 문단 안에서 핵심 수치(금액, %, 건수)와 실제 항목명은 **텍스트**처럼 마크다운 볼드로 감쌀 것

[문체 - 반드시 지킬 것]
- 모든 문장은 "-요"로 끝나는 부드러운 대화체로 쓸 것. "-습니다/-니다" 격식체, "~하고 있습니다", "~것이 필요합니다", "~것이 효과적입니다" 같은 보고서식 명사형 종결 절대 금지
- 항목명을 따옴표로 감싸서 나열하지 말고 문장에 자연스럽게 녹여 쓸 것 (예: 'db생명(투자용)'과 '가족계' (X) → db생명이랑 가족계 (O))
- 아래 나쁜 예처럼 딱딱하게 쓰지 말고, 좋은 예처럼 편하게 쓸 것:
  나쁜 예: "이번 달 지출은 9건의 결제로 이루어졌고, 고정비가 총 지출의 약 72%를 차지하며 주요 소비 패턴을 형성하고 있습니다."
  좋은 예: "이번 달엔 **9번** 결제하셨는데, 그중 db생명이랑 가족계 같은 고정비가 **72%**나 차지했어요."
  나쁜 예: "다음 달에는 '쑥생일선물'과 같은 친목비 지출을 미리 예산에 반영하는 것이 효과적입니다."
  좋은 예: "쑥 생일선물처럼 갑자기 생기는 친목비는 다음 달 예산에 미리 넣어두면 마음이 편할 거예요."
  나쁜 예(추상적/시점 어색): "남은 기간 목표를 다 채우려면 하루 평균 31,290원씩 모으면 딱 맞아요." (이미 끝난 달 리포트에서 '남은 기간'이 모호하고, 무엇을 줄여야 하는지도 안 나와 있음)
  좋은 예(구체적 실행법과 연결): "다음 달에 생활비만 **3만원** 줄여도, 목표까지 필요한 하루 평균 **31,290원**을 어렵지 않게 채울 수 있어요."

[내용 - 반드시 지킬 것, 아래 순서로 자연스럽게 이어질 것]
1. 총지출·저축률처럼 화면에 이미 보이는 숫자를 그대로 나열하지 말고, "왜 그런 결과가 나왔는지"를 지출 TOP3 항목/건수로 짚어줄 것
2. 지난달 코칭 기록이 있으면, 그때 얘기했던 내용과 이번 달 실제 결과(카테고리별 amount vs prevAmount)를 비교해서 자연스럽게 한마디 남길 것. 지난달 코칭 기록이 없으면 이 부분은 완전히 생략 (없다는 말도 하지 말 것)
3. 수입 대비 저축률 데이터가 있으면, 권장 기준과 비교해서 짧게 짚어줄 것. 데이터 없으면 생략
4. 아래 [절감 여지가 있는 카테고리]를 지목해서 구체적으로 얼마를 줄이면 좋을지 제안하고, 그 절감액이 다음 달 저축 목표(하루 평균 절약액)에 어떻게 도움되는지 자연스럽게 연결해서 설명할 것. "남은 기간"이라는 모호한 표현 대신 반드시 "다음 달"이라고 명시할 것. 절감 여지 카테고리가 없으면 이 부분은 생략
5. 지출 TOP3 중 최소 1개의 실제 항목명을 지목해서 구체적인 다음 행동 제안으로 마무리. 카테고리명만 언급 금지, 질문형("~하는 건 어떨까요?")으로 끝내지 말 것

데이터:
- ${monthLabel}(${input.yearMonth}): ${input.totalSpent.toLocaleString()}원 지출 (총 ${input.txnCount ?? '?'}건 결제)
- 전월 대비: ${diff !== null ? (diff > 0 ? `▲${diff}% 증가` : `▼${Math.abs(diff)}% 감소`) : '데이터 없음'}
- 지출 금액 1위 카테고리: ${topSpending ? `${topSpending.cat} (${topSpending.amount.toLocaleString()}원)` : '없음'}
- 이번 달 고액 지출 TOP3:
${topItemsLines || '  - 데이터 없음'}
- 카테고리별 이번 달 vs 전달 지출: ${input.catData.filter(c => c.amount > 0).map(c => `${c.cat} ${c.amount.toLocaleString()}원(전달 ${c.prevAmount.toLocaleString()}원)`).join(', ') || '데이터 없음'}
- 절감 여지가 있는 카테고리: ${overspendLine}
- 지난달 코칭 기록: ${lastMonthCoachText ? `"${lastMonthCoachText}"` : '없음 (첫 코칭이거나 기록 없음 — 언급하지 말 것)'}
- 수입 대비 저축률: ${savingsRatePct !== null ? `${savingsRatePct}% (일반적 권장 기준: ${SAVING_RATE_GUIDELINE_PCT}%)` : '데이터 없음 (언급하지 말 것)'}
- 저축 목표: ${input.savingGoal > 0 ? `${input.savingGoal.toLocaleString()}원` : '미설정'}
- 실제 저축: ${input.savingGoal > 0 ? `${input.savedAmount.toLocaleString()}원 (${Math.round((input.savedAmount / input.savingGoal) * 100)}%)` : '미설정'}
- 목표까지 남은 금액: ${remainToGoal > 0 ? `${remainToGoal.toLocaleString()}원 (다음 달 하루 ${dailySaveNeeded.toLocaleString()}원씩 저축하면 도달 가능)` : '미설정 또는 이미 달성'}

JSON만 출력. 설명 금지.
형식: {"message":"\\n\\n으로 구분된 2~4문단짜리 코칭 메시지, 핵심 수치는 **볼드**"}

위 [문체] 예시의 "좋은 예"처럼 카톡으로 편하게 말 걸듯이, 인사말 없이 바로 본론으로 시작할 것.`
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

async function generateCoach(input: CoachInput, lastMonthCoachText: string): Promise<{ message: string }> {
  const prompt = buildPrompt(input, lastMonthCoachText)

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
        if (!parsed.message || typeof parsed.message !== 'string') {
          console.error(`[ai-coach] Gemini ${model} 파싱 결과에 message 필드 누락:`, parsed)
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

    // 지난달 코칭 회고용 - 실패해도 신규 생성 자체는 막지 않음
    const prevYearMonth = dayjs(yearMonth).subtract(1, 'month').format('YYYY-MM')
    const { data: prevReport } = await supabase
      .from('reports')
      .select('ai_coach')
      .eq('user_id', userId)
      .eq('year_month', prevYearMonth)
      .single()
    const lastMonthCoachText = extractCoachText(prevReport?.ai_coach)

    // 생성
    const coach = await generateCoach(body, lastMonthCoachText)

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
