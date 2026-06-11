import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'OCR 기능이 설정되지 않았습니다' }, { status: 503 })
    }
    const client = new Anthropic({ apiKey })

    const { imageBase64, mediaType } = await req.json()

    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType || 'image/jpeg',
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: `이 영수증 이미지에서 지출 정보를 추출해주세요.
반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 JSON만:
{
  "name": "가게명 또는 항목명",
  "amount": 금액(숫자만),
  "category": "생활비|활동비|고정비|친목비|예비비 중 하나",
  "payment_method": "결제수단 또는 null",
  "date": "YYYY-MM-DD 형식 또는 오늘 날짜"
}
영수증이 아니거나 정보를 읽을 수 없으면: {"error": "읽을 수 없는 이미지입니다"}`,
          },
        ],
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: '파싱 실패' }, { status: 400 })

    const result = JSON.parse(jsonMatch[0])
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })

    if (!result.date) result.date = new Date().toISOString().split('T')[0]

    return NextResponse.json({ result })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
