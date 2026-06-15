import Anthropic from '@anthropic-ai/sdk'

// Gemini 모델 우선순위 (stable → preview 순)
const GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-2.5-flash',
  'gemini-2.5-flash-preview-05-20',
  'gemini-1.5-flash',
]

async function callGeminiModel(model: string, prompt: string, apiKey: string, signal: AbortSignal): Promise<string | null> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 2048, temperature: 0.1 },
      }),
      signal,
    }
  )
  if (!res.ok) {
    if (res.status === 429) throw new Error('GEMINI_RATE_LIMIT')
    const errText = await res.text().catch(() => '')
    console.error(`[ai-input] Gemini ${model} HTTP ${res.status}:`, errText)
    return null
  }
  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null
  if (text) console.log(`[ai-input] Gemini ${model} OK`)
  return text
}

async function callGemini(prompt: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.log('[ai-input] GEMINI_API_KEY not set')
    return null
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    try {
      for (const model of GEMINI_MODELS) {
        const result = await callGeminiModel(model, prompt, apiKey, controller.signal)
        if (result) return result
      }
      return null
    } finally {
      clearTimeout(timeout)
    }
  } catch (e: any) {
    if (e.message === 'GEMINI_RATE_LIMIT') throw e
    console.error('[ai-input] Gemini error:', e?.message)
    return null
  }
}

async function callClaude(prompt: string): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.log('[ai-input] ANTHROPIC_API_KEY not set, skipping Claude fallback')
    return null
  }
  try {
    const anthropic = new Anthropic({ apiKey })
    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })
    return res.content[0].type === 'text' ? res.content[0].text.trim() : null
  } catch (e: any) {
    console.error('[ai-input] Claude fallback error:', e?.message ?? e)
    return null
  }
}

function buildPrompt(text: string): string {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const today = kst.toISOString().split('T')[0]
  return `오늘: ${today}
입력: "${text}"

JSON 배열만 반환. 설명 없이.
형식: [{"name":"항목명","amount":숫자,"category":"카테고리","date":"YYYY-MM-DD","payment_method_hint":"결제수단또는null","type":"expense또는income"}]

category 값은 반드시 아래 5개 중 하나만 (괄호 없이 그대로):
생활비 | 활동비 | 고정비 | 친목비 | 예비비
분류 기준(참고): 생활비=마트편의점식료품, 활동비=카페배달외식쇼핑, 고정비=구독월세통신, 친목비=술모임선물, 예비비=기타
type: expense(지출) | income(수입 - 월급 급여 용돈 환불 등)
날짜 없으면 오늘 사용.
amount 규칙: 삼천=3000 사천=4000 오천=5000 육천=6000 칠천=7000 팔천=8000 구천=9000 만=10000 이만=20000 | 숫자+원/천원/만원 계산 (예: 6천원=6000 3만5천원=35000 1500원=1500)
name 약어: 아아/아아이스->아이스아메리카노 따아->아메리카노 배민->배달의민족 맹날->맥도날드 스벅/스범/스밹->스타벅스
여러 항목이면 각각 분리해서 배열에. 1건이어도 배열로.`
}

function parseJson(raw: string): any[] | null {
  const codeMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  const jsonStr = codeMatch ? codeMatch[1].trim() : raw
  const arrMatch = jsonStr.match(/\[[\s\S]*\]/)
  if (!arrMatch) return null
  try {
    const parsed = JSON.parse(arrMatch[0])
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  try {
    const { text } = await req.json()
    if (!text?.trim()) {
      return Response.json({ error: 'EMPTY_INPUT' }, { status: 400 })
    }

    // 줄바꿈을 쉼표로 정규화 (여러 줄 입력 지원)
    const normalized = text.trim().replace(/\r?\n+/g, ', ')
    const prompt = buildPrompt(normalized)
    let raw: string | null = null
    let usedFallback = false

    // 1차: Gemini
    try {
      raw = await callGemini(prompt)
      console.log('[ai-input] Gemini result:', raw ? 'OK' : 'null')
    } catch (e: any) {
      console.log('[ai-input] Gemini error:', e?.message)
      if (e.message === 'GEMINI_RATE_LIMIT') {
        usedFallback = true
      }
    }

    // 2차: Claude Haiku fallback
    if (!raw) {
      console.log('[ai-input] Trying Claude fallback...')
      raw = await callClaude(prompt)
      usedFallback = true
      console.log('[ai-input] Claude result:', raw ? 'OK' : 'null')
    }

    if (!raw) {
      return Response.json({ error: 'AI_UNAVAILABLE' }, { status: 503 })
    }

    const parsed = parseJson(raw)
    if (!parsed || parsed.length === 0) {
      return Response.json({ error: 'PARSE_FAILED' }, { status: 422 })
    }

    const items = parsed
      .filter(item => item.amount != null && item.amount !== '' && Number(item.amount) > 0)
      .map(item => ({
        name: item.name ?? '항목',
        amount: Number(item.amount),
        category: (item.category ?? '예비비').replace(/\(.*?\)/g, '').trim() || '예비비',
        date: item.date ?? new Date().toISOString().split('T')[0],
        payment_method: item.payment_method_hint ?? null,
        type: (item.type === 'income' ? 'income' : 'expense') as 'expense' | 'income',
        memo: null as null,
      }))

    if (items.length === 0) {
      return Response.json(
        { error: '금액을 인식하지 못했어요. 예) 아아 3000원 / 커피 삼천원' },
        { status: 422 }
      )
    }

    return Response.json({ items, usedFallback })
  } catch (e: any) {
    console.error('[ai-input]', e?.message ?? e)
    return Response.json({ error: e?.message ?? 'UNKNOWN' }, { status: 500 })
  }
}
