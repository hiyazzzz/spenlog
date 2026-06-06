import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin
  const errorParam = requestUrl.searchParams.get('error_code')
  const errorDesc = requestUrl.searchParams.get('error_description')

  // identity_already_exists: 다른 계정에 이미 연결된 소셜 계정
  if (errorParam === 'identity_already_exists') {
    return NextResponse.redirect(`${origin}/settings?link_error=already_linked`)
  }

  if (code) {
    const supabaseResponse = NextResponse.redirect(`${origin}/auth/check`)
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
