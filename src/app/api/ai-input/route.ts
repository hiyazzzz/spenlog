import Anthropic from '@anthropic-ai/sdk'

async function callGemini(prompt: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 512, temperature: 0.1 },
        }),
        signal: controller.signal,
      }
    )
    clearTimeout(timeout)
    if (!res.ok) {
      if (res.status === 429) throw new Error('GEMINI_RATE_LIMIT')
      return null
    }
    const data = await res.json()
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null
  } catch (e: any) {
    if (e.message === 'GEMINI_RATE_LIMIT') throw e
    return null
  }
}

async function callClaude(prompt: string): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  const anthropic = new Anthropic({ apiKey })
  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  })
  return res.content[0].type === 'text' ? res.content[0].text.trim() : null
}

function buildPrompt(text: string): string {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const today = kst.toISOString().split('T')[0]
  return `오늘: ${today}
입력: "${text}"

JSON 배열만 반환. 설명 없이.
형식: [{"name":"항목명","amount":숫자,"category":"카테고리","date":"YYYY-MM-DD","payment_method_hint":"결제수단또는null","type":"expense또는income"}]

카테고리(하나만): 생활비(마트편의점식료품) | 활동비(카페배달외식쇼핑) | 고정비(구독월세통신) | 친목비(술모임선물) | 예비비(기타)
type: expense(지출) | income(수입 - 월급 급여 용돈 환불 등)
날짜 없으면 오늘 사용.
amount 규칙: 삼천=3000 오천=5000 만=10000 이만=20000 | 숫자+원/천원/만원 계산
name 약어: 아아/아아이스->아이스아메리카노 따아->아메리카노 배민->배달의민족 맹날->맥도날드 스범/스밹->스타벅스
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

    const prompt = buildPrompt(text.trim())
    let raw: string | null = null
    let usedFallback = false

    // 1차: Gemini
    try {
      raw = await callGemini(prompt)
    } catch (e: any) {
      if (e.message === 'GEMINI_RATE_LIMIT') {
        usedFallback = true
      }
    }

    // 2차: Claude Haiku fallback
    if (!raw) {
      raw = await callClaude(prompt)
      usedFallback = true
    }

    if (!raw) {
      return Response.json({ error: 'AI_UNAVAILABLE' }, { status: 503 })
    }

    const parsed = parseJson(raw)
    if (!parsed || parsed.length === 0) {
      return Response.json({ error: 'PARSE_FAILED' }, { status: 422 })
    }

    const items = parsed
      .filter(item => item.amount && typeof item.amount === 'number' && item.amount > 0)
      .map(item => ({
        name: item.name ?? '항목',
        amount: item.amount,
        category: item.category ?? '예비비',
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
