import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const from = requestUrl.searchParams.get('from')
  const origin = requestUrl.origin
  const errorParam = requestUrl.searchParams.get('error_code')

  // identity_already_exists: 다른 계정에 이미 연결된 소셜 계정
  if (errorParam === 'identity_already_exists') {
    return NextResponse.redirect(`${origin}/settings?link_error=already_linked`)
  }

  if (code) {
    // 게스트 연동 플로우는 link-handler로, 일반 로그인은 auth/check로
    const redirectTarget = from === 'guest_link'
      ? `${origin}/auth/link-handler`
      : `${origin}/auth/check`

    const supabaseResponse = NextResponse.redirect(redirectTarget)
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return supabaseResponse
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
