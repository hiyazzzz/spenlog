import { createClient as createClientFromCookies } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/migrate-guest
 * 게스트(익명) 유저의 데이터를 신규 구글 계정으로 이전
 *
 * RLS 우회를 위해 service_role 키 사용
 * 필요 환경변수: SUPABASE_SERVICE_ROLE_KEY
 */
export async function POST(req: NextRequest) {
  try {
    // 1. 요청자 인증 확인 (anon client로 세션 확인)
    const anonClient = await createClientFromCookies()
    const { data: { user: currentUser } } = await anonClient.auth.getUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { fromUserId, toUserId } = await req.json()

    // 2. toUserId가 현재 로그인 유저와 일치해야 함 (보안)
    if (!fromUserId || !toUserId || toUserId !== currentUser.id) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    // 3. service_role 키로 RLS 우회
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      console.error('[migrate-guest] SUPABASE_SERVICE_ROLE_KEY not set')
      return NextResponse.json({ error: 'Server config error' }, { status: 500 })
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 4. 각 테이블 user_id 일괄 이전 (순서 중요: FK 참조 없는 것부터)
    const tables = [
      'expenses',
      'budgets',
      'fixed_costs',
      'cards',
      'accounts',
      'categories',
    ]

    const results: Record<string, unknown> = {}

    for (const table of tables) {
      const { error } = await admin
        .from(table)
        .update({ user_id: toUserId })
        .eq('user_id', fromUserId)

      if (error) {
        console.warn(`[migrate-guest] ${table} migration warning:`, error.message)
        results[table] = { error: error.message }
      } else {
        results[table] = { ok: true }
      }
    }

    // 5. 게스트 유저 프로필에서 이름, 수입, 목표 등을 가져와 복사
    const { data: guestProfile } = await admin
      .from('users')
      .select('name, monthly_income, savings_goal, category_img_url_1, category_img_url_2, category_img_url_3, category_img_url_4, home_cover_url, gif_autoplay')
      .eq('id', fromUserId)
      .single()

    // toUserId 프로필이 비어있을 때만 복사
    if (guestProfile) {
      const { data: targetProfile } = await admin
        .from('users')
        .select('name')
        .eq('id', toUserId)
        .single()

      if (!targetProfile?.name) {
        await admin
          .from('users')
          .update({
            name: guestProfile.name,
            monthly_income: guestProfile.monthly_income,
            savings_goal: guestProfile.savings_goal,
            category_img_url_1: guestProfile.category_img_url_1,
            category_img_url_2: guestProfile.category_img_url_2,
            category_img_url_3: guestProfile.category_img_url_3,
            category_img_url_4: guestProfile.category_img_url_4,
            home_cover_url: guestProfile.home_cover_url,
            gif_autoplay: guestProfile.gif_autoplay,
            onboarding_completed: true,
          })
          .eq('id', toUserId)
      }
    }

    return NextResponse.json({ ok: true, results })
  } catch (e: unknown) {
    console.error('[migrate-guest] error:', e)
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
