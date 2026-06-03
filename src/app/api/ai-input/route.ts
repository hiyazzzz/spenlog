import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// 한글 숫자 → 아라비아 숫자 변환
function normalizeKoreanNumber(text: string): string {
  const map: Record<string, number> = {
    '영': 0, '일': 1, '이': 2, '삼': 3, '사': 4,
    '오': 5, '육': 6, '칠': 7, '팔': 8, '구': 9,
    '십': 10, '백': 100, '천': 1000, '만': 10000,
  }

  // "삼천원" → "3000원", "이만오천원" → "25000원" 등 변환
  let result = text
  result = result.replace(/([일이삼사오육칠팔구]?)(천)([일이삼사오육칠팔구]?)(백)?([일이삼사오육칠팔구]?)(십)?([일이삼사오육칠팔구]?)/g, (match) => {
    if (!match) return match
    let total = 0
    let i = 0
    const chars = match.split('')
    while (i < chars.length) {
      const v = map[chars[i]] ?? 0
      if (v >= 1000) { total = (total || 1) * v; i++ }
      else if (v >= 100) { total += (map[chars[i-1]] || 1) * v; i++ }
      else if (v >= 10) { total += (map[chars[i-1]] || 1) * v; i++ }
      else { i++ }
    }
    return total > 0 ? String(total) : match
  })

  // 단순 패턴: "삼천", "오천", "일만" 등
  result = result
    .replace(/([일이삼사오육칠팔구]?)만([일이삼사오육칠팔구]?)천/g, (_, man, chun) => {
      const m = (man ? (map[man] ?? 1) : 1) * 10000
      const c = (chun ? (map[chun] ?? 0) : 0) * 1000
      return String(m + c)
    })
    .replace(/([일이삼사오육칠팔구]?)만/g, (_, n) => String((n ? (map[n] ?? 1) : 1) * 10000))
    .replace(/([일이삼사오육칠팔구]?)천/g, (_, n) => String((n ? (map[n] ?? 1) : 1) * 1000))
    .replace(/([일이삼사오육칠팔구]?)백/g, (_, n) => String((n ? (map[n] ?? 1) : 1) * 100))

  return result
}

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

    // 한글 숫자 전처리
    const normalizedText = normalizeKoreanNumber(text)

    // 유저 카드 목록 조회 (카드명 힌트 제공용)
    const { data: cards } = await supabase.from('cards').select('name, bank').eq('user_id', user.id)
    const cardHint = cards && cards.length > 0
      ? `유저 등록 카드: ${cards.map(c => `${c.name}(${c.bank})`).join(', ')}`
      : '등록된 카드 없음'

    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: `다음 가계부 입력 텍스트를 JSON으로 파싱해줘.
텍스트: "${normalizedText}"
(원본: "${text}")

반드시 아래 JSON 형식으로만 응답해. 설명 없이 JSON만:
{
  "name": "지출 항목명 (간결하게, 2~6자)",
  "amount": 숫자만 (원 단위, 반드시 양수),
  "category": "생활비 | 활동비 | 고정비 | 친목비 | 예비비 중 하나",
  "payment_method": "결제수단명 (없으면 null)",
  "date": "YYYY-MM-DD",
  "memo": null
}

카테고리 기준:
- 생활비: 식료품, 마트, 밥, 식사, 생필품, 편의점
- 활동비: 카페, 배달, 외식, 취미, 쇼핑, 음료
- 고정비: 구독, 통신비, 월세, 보험, 자동이체
- 친목비: 술, 회식, 모임, 선물, 경조사
- 예비비: 기타, 분류 어려운 것

오늘 날짜: ${new Date().toISOString().split('T')[0]}

약어/은어 변환:
- 아아, 아아이스 → 아이스 아메리카노 (활동비)
- 따아 → 따뜻한 아메리카노 (활동비)
- 라떼, 라뗴 → 라떼
- 버거, 맥날, 맥도날드 → 맥도날드
- 배민 → 배달의민족
- 쿠팡이츠, 쿠팡 → 쿠팡이츠
- 편의점, 편 → 편의점 (생활비)

금액 변환: 숫자+단위 예시
- 3천, 3천원 → 3000
- 1만5천 → 15000
- 2.5만 → 25000

결제수단 감지:
- 카드 언급 시 카드명 그대로 (예: "신한카드" → "신한카드")
- 유저 카드와 매칭 시도: ${cardHint}
- 현금/cash → "현금"
- 카카오페이/카페이 → "카카오페이"
- 네이버페이 → "네이버페이"
- 토스 → "토스"
- 없으면 null`,
        },
      ],
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Unexpected response type')

    const jsonMatch = content.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('JSON 파싱 실패')

    const parsed = JSON.parse(jsonMatch[0])

    // amount 검증
    if (!parsed.amount || parsed.amount <= 0 || isNaN(parsed.amount)) {
      return NextResponse.json({ error: '금액을 인식하지 못했어요. "커피 3500원" 형식으로 입력해 주세요.' }, { status: 422 })
    }

    // 카드 목록 함께 반환 (UI에서 선택용)
    return NextResponse.json({ result: parsed, cards: cards ?? [] })

  } catch (error) {
    console.error('AI input error:', error)
    return NextResponse.json(
      { error: 'AI 분류에 실패했습니다. 다시 시도해주세요.' },
      { status: 500 }
    )
  }
}
