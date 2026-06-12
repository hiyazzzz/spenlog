import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // 정적 리소스, auth 경로, 로그인 페이지, API 라우트 제외 (모바일 앱은 쿠키 세션이 없어 API를 직접 호출함)
  const isPublic =
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.includes('.')

  if (isPublic) {
    return NextResponse.next({ request })
  }

  // Supabase 세션 쿠키 존재 여부만 확인 (Edge Runtime 호환)
  const cookies = request.cookies.getAll()
  const hasSession = cookies.some(c =>
    c.name.startsWith('sb-') && c.name.includes('-auth-token')
  )

  if (!hasSession) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return NextResponse.next({ request })
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
