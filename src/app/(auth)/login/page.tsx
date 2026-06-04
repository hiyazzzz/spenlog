'use client'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  async function handleGoogle() {
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (err) { setError(err.message); setLoading(false) }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column' as const,
      justifyContent: 'center',
      alignItems: 'center',
      padding: '0 32px',
      background: '#FAF7F4',
      maxWidth: '420px',
      margin: '0 auto',
    }}>
      {/* 로고 */}
      <div style={{ textAlign: 'center' as const, marginBottom: '56px' }}>
        <h1 style={{ fontSize: '48px', fontWeight: '800', color: '#6B1E2E', letterSpacing: '-2px', marginBottom: '8px' }}>
          Spenlog
        </h1>
        <p style={{ fontSize: '14px', color: '#B8A8AC', letterSpacing: '0.05em' }}>
          spend · log · reflect
        </p>
      </div>

      {/* 구글 로그인 버튼 */}
      <button
        onClick={handleGoogle}
        disabled={loading}
        style={{
          width: '100%',
          padding: '16px',
          borderRadius: '16px',
          background: loading ? '#C4A0A8' : '#fff',
          border: '1.5px solid #EDE3E5',
          fontSize: '15px',
          fontWeight: '600',
          color: '#3D2020',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}
      >
        {loading ? (
          <span>연결 중...</span>
        ) : (
          <>
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Google로 계속하기
          </>
        )}
      </button>

      {error && (
        <p style={{ fontSize: '13px', color: '#E05070', marginTop: '16px', textAlign: 'center' as const }}>
          {error}
        </p>
      )}

      {/* 약관 안내 */}
      <p style={{ fontSize: '11px', color: '#C4A0A8', marginTop: '32px', textAlign: 'center' as const, lineHeight: 1.6 }}>
        계속하면 <span style={{ textDecoration: 'underline' }}>이용약관</span> 및{' '}
        <span style={{ textDecoration: 'underline' }}>개인정보처리방침</span>에{'\n'}동의하게 됩니다
      </p>
    </div>
  )
}
