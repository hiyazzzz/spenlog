import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { text } = body

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: '입력 텍스트가 없습니다' }, { status: 400 })
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: '[설정오류] GEMINI_API_KEY가 설정되지 않았습니다' }, { status: 500 })
    }

    const { data: cards } = await supabase.from('cards').select('name, bank').eq('user_id', user.id)
    const cardList = cards && cards.length > 0 ? cards.map((c: any) => c.name).join(', ') : null

    const now = new Date()
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
    const today = kst.toISOString().split('T')[0]

    const prompt = [
      'JSON만 출력. 설명 금지. 마크다운 금지.',
      `입력: "${text.trim()}"`,
      `오늘: ${today}`,
      cardList ? `유저카드: ${cardList}` : null,
      '출력형식(반드시 이 구조만): {"name":"항목명","amount":숫자,"category":"카테고리","payment_method":null또는문자열,"date":"YYYY-MM-DD","memo":null}',
      'amount규칙: 삼천=3000 오천=5000 만=10000 만오천=15000 이만=20000 삼만=30000 | 3천=3000 5천=5000 1만=10000 | 숫자+원/천원/만원 계산',
      'name약어: 아아/아아이스→아이스아메리카노 따아→아메리카노 배민→배달의민족 편의점/편→편의점 맥날→맥도날드 스벅→스타벅스',
      'category선택(하나만): 활동비(카페배달외식음료쇼핑) 생활비(마트편의점식료품) 고정비(구독월세통신) 친목비(술모임선물) 예비비(기타)',
      'payment_method: 카드/현금/카카오페이/네이버페이/토스 언급시 그대로 기재, 없으면 null',
    ].filter(Boolean).join('\n')

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 256, temperature: 0.1 },
        }),
      }
    )

    if (!geminiRes.ok) {
      const errText = await geminiRes.text()
      throw new Error(`Gemini API error ${geminiRes.status}: ${errText.slice(0, 100)}`)
    }

    const geminiData = await geminiRes.json()
    const raw = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    if (!raw) throw new Error('Gemini 응답 없음')

    // JSON 추출
    const codeMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    const jsonStr = codeMatch ? codeMatch[1].trim() : raw
    const objMatch = jsonStr.match(/\{[\s\S]*\}/)
    if (!objMatch) throw new Error('JSON not found: ' + raw.slice(0, 80))

    const parsed = JSON.parse(objMatch[0])

    if (!parsed.amount || typeof parsed.amount !== 'number' || parsed.amount <= 0) {
      return NextResponse.json(
        { error: '금액을 인식하지 못했어요. 예) 아아 3000원 / 커피 삼천원' },
        { status: 422 }
      )
    }

    return NextResponse.json({ result: parsed, cards: cards ?? [] })

  } catch (error: any) {
    const msg = error?.message || String(error)
    console.error('[ai-input]', msg)
    return NextResponse.json(
      { error: `분류 실패: ${msg.slice(0, 120)}` },
      { status: 500 }
    )
  }
}
