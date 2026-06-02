import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { text } = await req.json()

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    system: `너는 가계부 앱의 AI 지출 분류기야.
사용자의 자연어 입력을 파싱해서 반드시 아래 JSON 형식으로만 응답해. 다른 텍스트는 절대 포함하지 마.

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
- 예비비: 기타, 분류 어려운 것`,
    messages: [{ role: 'user', content: text }],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : ''

  try {
    const parsed = JSON.parse(raw)
    return NextResponse.json({ result: parsed })
  } catch {
    return NextResponse.json({ error: '파싱 실패', raw }, { status: 400 })
  }
}