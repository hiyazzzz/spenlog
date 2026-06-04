'use client'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleGoogle() {
    setLoading(true)
    setError('')
    try {
      const supabase = createClient()
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })
      if (err) {
        setError(err.message)
        setLoading(false)
      }
      // 정상이면 Google 페이지로 리다이렉트됨 (loading 유지)
    } catch (e: any) {
      setError(e?.message ?? '구글 로그인 중 오류가 발생했어요')
      setLoading(false)
    }
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
      <div style={{ textAlign: 'center' as const, marginBottom: '64px' }}>
        <h1 style={{
          fontSize: '52px', fontWeight: '800', color: '#6B1E2E',
          letterSpacing: '-2px', marginBottom: '12px', lineHeight: 1,
        }}>
          Spenlog
        </h1>
        <p style={{ fontSize: '13px', color: '#C4A0A8', letterSpacing: '0.08em', fontWeight: '400' }}>
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
          background: loading ? '#F5EFED' : '#fff',
          border: '1.5px solid #EDE3E5',
          fontSize: '15px',
          fontWeight: '600',
          color: loading ? '#C4A0A8' : '#3D2020',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          boxShadow: loading ? 'none' : '0 2px 8px rgba(0,0,0,0.06)',
          transition: 'all 0.2s',
        }}
      >
        {loading ? (
          <>
            <div style={{
              width: 20, height: 20, borderRadius: '50%',
              border: '2px solid #EDE3E5', borderTopColor: '#6B1E2E',
              animation: 'spin 0.8s linear infinite',
            }} />
            연결 중...
          </>
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
        <div style={{
          marginTop: '16px', padding: '12px 16px',
          background: '#FFF5F7', border: '1px solid #F5D0D8',
          borderRadius: '12px', width: '100%',
        }}>
          <p style={{ fontSize: '13px', color: '#C0405A', margin: 0, textAlign: 'center' as const }}>
            {error}
          </p>
        </div>
      )}

      {/* 약관 안내 */}
      <p style={{
        fontSize: '11px', color: '#C4A0A8', marginTop: '32px',
        textAlign: 'center' as const, lineHeight: 1.8,
      }}>
        계속하면 <span style={{ textDecoration: 'underline', textUnderlineOffset: '2px' }}>이용약관</span> 및{' '}
        <span style={{ textDecoration: 'underline', textUnderlineOffset: '2px' }}>개인정보처리방침</span>에 동의하게 됩니다
      </p>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
