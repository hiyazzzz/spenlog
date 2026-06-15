'use client'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [googleLoading, setGoogleLoading] = useState(false)
  const [guestLoading, setGuestLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  async function handleGoogle() {
    setGoogleLoading(true); setError('')
    try {
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      })
      if (err) { setError(err.message); setGoogleLoading(false) }
    } catch (e: any) {
      setError(e?.message ?? '구글 로그인 중 오류가 발생했어요')
      setGoogleLoading(false)
    }
  }

  async function handleGuest() {
    setGuestLoading(true); setError('')
    try {
      const { error: err } = await supabase.auth.signInAnonymously()
      if (err) throw err
      router.push('/auth/check')
    } catch (e: any) {
      setError('게스트 모드를 사용할 수 없어요.')
      setGuestLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--color-bg, #FAF7F4)',
      padding: '0 32px',
    }}>
      {/* 로고 영역 */}
      <div style={{ textAlign: 'center', marginBottom: 56 }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: 'var(--color-accent, #6B1E2E)', marginBottom: 10, letterSpacing: '-0.5px' }}>
          Spenlog
        </h1>
        <p style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.6 }}>
          천천히, 꾸준히<br />나만의 가계부
        </p>
      </div>

      {/* 버튼 영역 */}
      <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Google 로그인 */}
        <button
          onClick={handleGoogle}
          disabled={googleLoading || guestLoading}
          style={{
            width: '100%', padding: '16px', borderRadius: 16,
            background: '#fff', border: '1.5px solid #e5e7eb',
            fontSize: 15, fontWeight: 600, color: '#1f2937',
            cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            opacity: (googleLoading || guestLoading) ? 0.7 : 1,
          }}
        >
          {googleLoading ? (
            <span>로그인 중...</span>
          ) : (
            <>
              {/* Google 아이콘 SVG */}
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google로 계속하기
            </>
          )}
        </button>

        {/* 구분선 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0' }}>
          <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
          <span style={{ fontSize: 12, color: '#9ca3af' }}>또는</span>
          <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
        </div>

        {/* 게스트 로그인 */}
        <button
          onClick={handleGuest}
          disabled={googleLoading || guestLoading}
          style={{
            width: '100%', padding: '16px', borderRadius: 16,
            background: 'var(--color-primary-light, #F8EFF1)',
            border: '1.5px solid var(--color-primary-light, #F8EFF1)',
            fontSize: 15, fontWeight: 600,
            color: 'var(--color-primary, #6B1E2E)',
            cursor: 'pointer', fontFamily: 'inherit',
            opacity: (googleLoading || guestLoading) ? 0.7 : 1,
          }}
        >
          {guestLoading ? '입장 중...' : '게스트로 둘러보기'}
        </button>

        {/* 게스트 안내 */}
        <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', lineHeight: 1.5 }}>
          게스트 모드는 기기 변경·로그아웃 시 데이터가 사라져요.<br />
          나중에 Google 계정과 연동해 영구 보관할 수 있어요.
        </p>

        {error && (
          <p style={{ fontSize: 13, color: '#ef4444', textAlign: 'center', marginTop: 4 }}>{error}</p>
        )}
      </div>
    </div>
  )
}
