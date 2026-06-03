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

    // API 키 존재 확인
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: '[설정오류] ANTHROPIC_API_KEY가 설정되지 않았습니다' }, { status: 500 })
    }

    const { data: cards } = await supabase.from('cards').select('name, bank').eq('user_id', user.id)
    const cardList = cards && cards.length > 0 ? cards.map((c: any) => c.name).join(', ') : null

    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const now = new Date()
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
    const today = kst.toISOString().split('T')[0]

    const prompt = [
      'JSON만 출력. 설명 금지.',
      `입력: "${text.trim()}"`,
      `오늘: ${today}`,
      cardList ? `유저카드: ${cardList}` : null,
      '형식: {"name":"항목명","amount":숫자,"category":"카테고리","payment_method":null,"date":"YYYY-MM-DD","memo":null}',
      'amount: 삼천=3000 오천=5000 만=10000 만오천=15000 이만=20000 삼만=30000 | 3천=3000 5천=5000 1만=10000',
      'name약어: 아아→아이스아메리카노 따아→아메리카노 배민→배달의민족 편의점/편→편의점 맥날→맥도날드',
      'category: 활동비(카페배달외식음료쇼핑) 생활비(마트편의점식료품) 고정비(구독월세통신) 친목비(술모임선물) 예비비(기타)',
      'payment_method: 카드/현금/카카오페이/네이버페이/토스 언급시 기재 없으면 null',
    ].filter(Boolean).join('\n')

    let message
    try {
      message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      })
    } catch (apiErr: any) {
      // 모델 오류 시 claude-3-5-haiku로 폴백
      if (apiErr?.status === 404 || apiErr?.message?.includes('model')) {
        message = await client.messages.create({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 200,
          messages: [{ role: 'user', content: prompt }],
        })
      } else {
        throw apiErr
      }
    }

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('non-text response')

    const raw = content.text.trim()
    const codeMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    const jsonStr = codeMatch ? codeMatch[1].trim() : raw
    const objMatch = jsonStr.match(/\{[\s\S]*\}/)
    if (!objMatch) throw new Error('JSON not found: ' + raw.slice(0, 100))

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
    const status = error?.status || 500
    console.error('[ai-input]', msg)
    // 개발 진단용: 실제 에러를 프론트에 노출
    return NextResponse.json(
      { error: `분류 실패: ${msg.slice(0, 120)}` },
      { status: 500 }
    )
  }
}
