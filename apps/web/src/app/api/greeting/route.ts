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
