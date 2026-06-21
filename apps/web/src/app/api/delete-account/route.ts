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
    // 1. 요청자 인증: Bearer 토큰(모바일) 또는 쿠키 세션(웹) 지원
    let currentUser: { id: string } | null = null

    const authHeader = req.headers.get('Authorization')
    if (authHeader?.startsWith('Bearer ')) {
      // 모바일 앱: Authorization: Bearer <access_token>
      const token = authHeader.slice(7)
      const anonClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } },
      )
      const { data: { user } } = await anonClient.auth.getUser(token)
      currentUser = user
    } else {
      // 웹: 쿠키 세션
      const cookieClient = await createClientFromCookies()
      const { data: { user } } = await cookieClient.auth.getUser()
      currentUser = user
    }

    if (!currentUser) {
      return NextResponse.json({ error: '인증 정보가 없어요' }, { status: 401 })
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

    // 4. Soft delete: users 테이블 숨김 처리 (Auth 유저는 유지 — 재로그인 시 새 프로필 생성)
    const { error: softDeleteError } = await admin
      .from('users')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      })
      .eq('id', userId)

    if (softDeleteError) {
      console.error('[delete-account] soft delete error:', softDeleteError.message)
      return NextResponse.json({ error: softDeleteError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    console.error('[delete-account] error:', e)
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
