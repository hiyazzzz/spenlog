import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const MAX_LAST_IDS = 5

/**
 * GET /api/greeting
 * greeting_templates 중 최근 노출되지 않은 항목을 랜덤 선택해 반환
 * 선택된 id는 users.greeting_last_ids 에 누적(최대 5개)
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ text: null })
  }

  // TODO: greeting_custom_text 컬럼 마이그레이션 적용 후, 유저가 직접 설정한
  // 커스텀 인사말이 있으면 템플릿 랜덤 선택보다 우선 반환하도록 처리 필요

  const { data: templates } = await supabase
    .from('greeting_templates')
    .select('id, text')
    .eq('is_active', true)

  if (!templates || templates.length === 0) {
    return NextResponse.json({ text: null })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('greeting_last_ids')
    .eq('id', user.id)
    .single()

  let lastIds: string[] = []
  try {
    lastIds = profile?.greeting_last_ids ? JSON.parse(profile.greeting_last_ids) : []
  } catch {
    lastIds = []
  }

  let candidates = templates.filter(t => !lastIds.includes(t.id))
  if (candidates.length === 0) candidates = templates

  const picked = candidates[Math.floor(Math.random() * candidates.length)]
  const newLastIds = [picked.id, ...lastIds.filter(id => id !== picked.id)].slice(0, MAX_LAST_IDS)

  await supabase.from('users').update({ greeting_last_ids: JSON.stringify(newLastIds) }).eq('id', user.id)

  return NextResponse.json({ text: picked.text })
}

/**
 * POST /api/greeting
 * 유저가 홈 편집에서 직접 입력한 커스텀 인사말 저장
 *
 * TODO: users 테이블에 greeting_custom_text 컬럼이 없음.
 *   마이그레이션 필요: ALTER TABLE users ADD COLUMN IF NOT EXISTS greeting_custom_text text;
 *   적용 후 아래 update가 정상 동작함. 적용 전까지는 GreetingText에서
 *   greeting_custom_text 우선 사용 로직도 함께 추가해야 함 (현재는 GET의 랜덤 템플릿만 사용).
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { text } = await req.json()
  if (typeof text !== 'string' || text.trim().length === 0 || text.length > 40) {
    return NextResponse.json({ error: 'invalid text' }, { status: 400 })
  }

  const { error } = await supabase
    .from('users')
    .update({ greeting_custom_text: text.trim() })
    .eq('id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
