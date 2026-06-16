import { createClient as createClientFromCookies } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/delete-account
 * 현재 로그인 유저의 계정을 완전 삭제 (Auth + users 테이블 cascade)
 *
 * auth.admin.deleteUser() 사용 — service_role 키 필요
 * 필요 환경변수: SUPABASE_SERVICE_ROLE_KEY
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Bearer 토큰으로 요청자 인증
    const anonClient = await createClientFromCookies()
    const { data: { user: currentUser } } = await anonClient.auth.getUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId } = await req.json()

    // 2. 삭제 대상이 본인인지 확인
    if (!userId || userId !== currentUser.id) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    // 3. service_role 키로 Admin SDK 초기화
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      console.error('[delete-account] SUPABASE_SERVICE_ROLE_KEY not set')
      return NextResponse.json({ error: 'Server config error' }, { status: 500 })
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    // 4. Auth 유저 삭제 (users 테이블은 ON DELETE CASCADE로 자동 삭제)
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) {
      console.error('[delete-account] deleteUser error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    console.error('[delete-account] error:', e)
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
