import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { text } = body

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: '입력 텍스트가 없습니다' }, { status: 400 })
    }

    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: `다음 가계부 입력 텍스트를 JSON으로 파싱해줘.
텍스트: "${text}"

반드시 아래 JSON 형식으로만 응답해. 설명 없이 JSON만:
{
  "name": "지출 항목명 (간결하게)",
  "amount": 숫자만 (원 단위),
  "category": "생활비 | 활동비 | 고정비 | 친목비 | 예비비 중 하나",
  "payment_method": "결제수단 (없으면 null)",
  "date": "YYYY-MM-DD (언급 없으면 오늘 날짜)",
  "memo": "추가 메모 (없으면 null)"
}

카테고리 기준:
- 생활비: 식료품, 마트, 식사, 생필품
- 활동비: 카페, 배달, 외식, 취미, 쇼핑
- 고정비: 구독, 통신, 월세, 보험, 자동이체
- 친목비: 술, 모임, 선물, 경조사
- 예비비: 기타, 분류 어려운 것

오늘 날짜: ${new Date().toISOString().split('T')[0]}
금액 단위 변환: 천원→×1000, 만원→×10000, 오천원→5000
아아=아이스 아메리카노`,
        },
      ],
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Unexpected response type')

    // JSON 추출 (마크다운 코드블록 포함 대응)
    const jsonMatch = content.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('JSON 파싱 실패')

    const parsed = JSON.parse(jsonMatch[0])
    return NextResponse.json({ result: parsed })

  } catch (error) {
    console.error('AI input error:', error)
    return NextResponse.json(
      { error: 'AI 분류에 실패했습니다. 다시 시도해주세요.' },
      { status: 500 }
    )
  }
}