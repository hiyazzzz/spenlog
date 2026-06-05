'use client'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Mode = 'login' | 'signup'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [guestLoading, setGuestLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailSent, setEmailSent] = useState(false)

  const supabase = createClient()

  async function handleGoogle() {
    setLoading(true); setError('')
    try {
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      })
      if (err) { setError(err.message); setLoading(false) }
    } catch (e: any) {
      setError(e?.message ?? '구글 로그인 중 오류가 발생했어요')
      setLoading(false)
    }
  }

  async function handleEmail() {
    if (!email.trim() || !password.trim()) { setError('이메일과 비밀번호를 입력해주세요'); return }
    setLoading(true); setError('')
    try {
      if (mode === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password })
        if (err) throw err
        router.push('/')
      } else {
        const { error: err } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        })
        if (err) throw err
        setEmailSent(true)
      }
    } catch (e: any) {
      const msg = e?.message ?? ''
      if (msg.includes('Invalid login credentials')) setError('이메일 또는 비밀번호가 틀렸어요')
      else if (msg.includes('already registered')) setError('이미 가입된 이메일이에요. 로그인해주세요')
      else setError(msg || '오류가 발생했어요')
    } finally { setLoading(false) }
  }

  async function handleGuest() {
    setGuestLoading(true); setError('')
    try {
      const { error: err } = await supabase.auth.signInAnonymously()
      if (err) throw err
      router.push('/')
    } catch (e: any) {
      setError('게스트 모드를 사용할 수 없어요. 회원가입 후 이용해주세요.')
    } finally { setGuestLoading(false) }
  }

  const divider = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
      <div style={{ flex: 1, height: 1, background: '#EDE3E5' }} />
      <span style={{ fontSize: 12, color: '#C4A0A8' }}>또는</span>
      <div style={{ flex: 1, height: 1, background: '#EDE3E5' }} />
    </div>
  )

  if (emailSent) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '0 32px', background: '#FAF7F4', maxWidth: 420, margin: '0 auto' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#6B1E2E', marginBottom: 8 }}>이메일을 확인해주세요</h2>
        <p style={{ fontSize: 14, color: '#9ca3af', textAlign: 'center', lineHeight: 1.7 }}>
          {email}로 인증 링크를 보냈어요.<br />링크를 클릭하면 로그인돼요.
        </p>
        <button onClick={() => setEmailSent(false)} style={{ marginTop: 24, fontSize: 13, color: '#6B1E2E', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>
          다시 시도
        </button>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '0 32px', background: '#FAF7F4', maxWidth: 420, margin: '0 auto' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* 로고 */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <h1 style={{ fontSize: 52, fontWeight: 800, color: '#6B1E2E', letterSpacing: '-2px', marginBottom: 12, lineHeight: 1 }}>Spenlog</h1>
        <p style={{ fontSize: 13, color: '#C4A0A8', letterSpacing: '0.08em' }}>spend · log · reflect</p>
      </div>

      <div style={{ width: '100%' }}>
        {/* 구글 로그인 */}
        <button onClick={handleGoogle} disabled={loading}
          style={{ width: '100%', padding: 16, borderRadius: 16, background: loading ? '#F5EFED' : '#fff', border: '1.5px solid #EDE3E5', fontSize: 15, fontWeight: 600, color: loading ? '#C4A0A8' : '#3D2020', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', transition: 'all 0.2s' }}>
          {loading ? (
            <><div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid #EDE3E5', borderTopColor: '#6B1E2E', animation: 'spin 0.8s linear infinite' }} />연결 중...</>
          ) : (
            <><svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>Google로 계속하기</>
          )}
        </button>

        {/* 카카오 (비활성) */}
        <button disabled style={{ width: '100%', marginTop: 10, padding: 16, borderRadius: 16, background: '#f9f9f9', border: '1.5px solid #e5e7eb', fontSize: 15, fontWeight: 600, color: '#9ca3af', cursor: 'not-allowed', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>🟡</span>카카오로 계속하기
          <span style={{ fontSize: 11, background: '#f3f4f6', padding: '2px 6px', borderRadius: 6 }}>곧 지원</span>
        </button>

        {divider}

        {/* 이메일 로그인/회원가입 탭 */}
        <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: 12, padding: 4, marginBottom: 16 }}>
          {(['login', 'signup'] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setError('') }}
              style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', background: mode === m ? '#fff' : 'transparent', color: mode === m ? '#6B1E2E' : '#9ca3af', boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
              {m === 'login' ? '로그인' : '회원가입'}
            </button>
          ))}
        </div>

        <input type="email" placeholder="이메일" value={email} onChange={e => { setEmail(e.target.value); setError('') }}
          style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '1.5px solid #EDE3E5', fontSize: 14, outline: 'none', fontFamily: 'inherit', marginBottom: 10, background: '#fff', boxSizing: 'border-box' }} />
        <input type="password" placeholder="비밀번호" value={password} onChange={e => { setPassword(e.target.value); setError('') }}
          onKeyDown={e => e.key === 'Enter' && handleEmail()}
          style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '1.5px solid #EDE3E5', fontSize: 14, outline: 'none', fontFamily: 'inherit', marginBottom: 12, background: '#fff', boxSizing: 'border-box' }} />

        <button onClick={handleEmail} disabled={loading}
          style={{ width: '100%', padding: 16, borderRadius: 16, border: 'none', background: loading ? '#C4A0A8' : '#6B1E2E', color: '#fff', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
          {loading ? '처리 중...' : mode === 'login' ? '로그인' : '회원가입'}
        </button>

        {error && (
          <div style={{ marginTop: 12, padding: '12px 16px', background: '#FFF5F7', border: '1px solid #F5D0D8', borderRadius: 12 }}>
            <p style={{ fontSize: 13, color: '#C0405A', margin: 0, textAlign: 'center' }}>{error}</p>
          </div>
        )}

        {divider}

        {/* 게스트 모드 */}
        <button onClick={handleGuest} disabled={guestLoading}
          style={{ width: '100%', padding: '14px', borderRadius: 16, border: '1.5px dashed #EDE3E5', background: 'transparent', fontSize: 14, color: '#9ca3af', cursor: guestLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
          {guestLoading ? '...' : '게스트로 둘러보기'}
        </button>

        <p style={{ fontSize: 11, color: '#C4A0A8', marginTop: 20, textAlign: 'center', lineHeight: 1.8 }}>
          계속하면 <span style={{ textDecoration: 'underline' }}>이용약관</span> 및{' '}
          <span style={{ textDecoration: 'underline' }}>개인정보처리방침</span>에 동의하게 됩니다
        </p>
      </div>
    </div>
  )
}
