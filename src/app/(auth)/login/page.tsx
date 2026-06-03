'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Mode = 'login' | 'signup'

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const router = useRouter()
  const supabase = createClient()

  function switchMode(m: Mode) {
    setMode(m)
    setError('')
    setInfo('')
  }

  async function handleAuth() {
    if (!email || !password) return
    setLoading(true)
    setError('')
    setInfo('')

    try {
      if (mode === 'signup') {
        const { data, error: err } = await supabase.auth.signUp({ email, password })
        if (err) {
          if (err.message.includes('already') || err.message.includes('registered')) {
            setError('이미 가입된 이메일이에요. 로그인해 주세요.')
          } else if (err.message.toLowerCase().includes('password')) {
            setError('비밀번호는 6자 이상으로 설정해 주세요.')
          } else {
            setError(err.message)
          }
        } else if (data.session) {
          // 이메일 인증 OFF: 바로 로그인
          router.refresh()
          router.push('/')
          return
        } else {
          setInfo('가입 완료! 이메일 인증 후 로그인해 주세요.')
        }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password })
        if (err) {
          if (err.message.includes('Invalid login credentials')) {
            setError('이메일 또는 비밀번호가 올바르지 않아요.')
          } else if (err.message.includes('Email not confirmed')) {
            setError('이메일 인증이 필요해요. 받은 편지함을 확인해 주세요.')
          } else {
            setError(err.message)
          }
        } else {
          router.refresh()
          router.push('/')
          return
        }
      }
    } catch (e: any) {
      setError('네트워크 오류가 발생했어요. 다시 시도해 주세요.')
    }

    setLoading(false)
  }

  async function handlePasswordReset() {
    if (!email) { setError('이메일을 먼저 입력해 주세요.'); return }
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    if (!err) setInfo(`${email}로 재설정 링크를 보냈어요.`)
    else setError(err.message)
  }

  const inputStyle = {
    width: '100%',
    padding: '14px 16px',
    borderRadius: '14px',
    border: '1.5px solid #EDE3E5',
    background: '#fff',
    fontSize: '14px',
    color: '#3D2020',
    outline: 'none',
    boxSizing: 'border-box' as const,
    fontFamily: 'inherit',
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column' as const,
      justifyContent: 'center',
      padding: '0 24px',
      background: '#FAF7F4',
      maxWidth: '420px',
      margin: '0 auto',
    }}>
      {/* 로고 */}
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '42px', fontWeight: '700', color: '#6B1E2E', letterSpacing: '-1px', marginBottom: '8px' }}>
          Spenlog
        </h1>
        <p style={{ fontSize: '13px', color: '#B8A8AC' }}>
          AI가 분류해주는 핀터레스트 감성 가계부
        </p>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', background: '#F0EAEC', borderRadius: '16px', padding: '4px', marginBottom: '16px', gap: '4px' }}>
        {(['login', 'signup'] as Mode[]).map((m) => (
          <button key={m} onClick={() => switchMode(m)} style={{
            flex: 1, padding: '10px', borderRadius: '12px', fontSize: '13px', fontWeight: '600',
            border: 'none', cursor: 'pointer', transition: 'all 0.2s',
            background: mode === m ? '#6B1E2E' : 'transparent',
            color: mode === m ? '#fff' : '#B8A8AC',
          }}>
            {m === 'login' ? '로그인' : '회원가입'}
          </button>
        ))}
      </div>

      {/* 입력 */}
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px' }}>
        <input type="email" placeholder="이메일" value={email}
          onChange={(e) => { setEmail(e.target.value); setError('') }}
          style={inputStyle} />
        <input type="password" placeholder="비밀번호 (6자 이상)" value={password}
          onChange={(e) => { setPassword(e.target.value); setError('') }}
          onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
          style={inputStyle} />

        {/* 에러 */}
        {error && (
          <div style={{ background: '#FFF5F7', border: '1px solid #F5D0D8', borderRadius: '12px', padding: '12px 14px' }}>
            <p style={{ fontSize: '13px', color: '#C0405A', margin: 0 }}>{error}</p>
          </div>
        )}

        {/* 안내 */}
        {info && (
          <div style={{ background: '#F0FAF4', border: '1px solid #C0E8D0', borderRadius: '12px', padding: '12px 14px' }}>
            <p style={{ fontSize: '13px', color: '#2E7D52', margin: 0 }}>✓ {info}</p>
          </div>
        )}

        {/* 버튼 */}
        <button onClick={handleAuth} disabled={loading || !email || !password} style={{
          width: '100%', padding: '14px', borderRadius: '14px',
          background: loading || !email || !password ? '#C4A0A8' : '#6B1E2E',
          color: '#fff', fontSize: '14px', fontWeight: '600', border: 'none',
          cursor: loading || !email || !password ? 'not-allowed' : 'pointer',
          marginTop: '4px', fontFamily: 'inherit',
        }}>
          {loading ? '처리 중...' : mode === 'login' ? '로그인' : '회원가입'}
        </button>

        {/* 비밀번호 찾기 */}
        {mode === 'login' && (
          <button onClick={handlePasswordReset} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '12px', color: '#B8A8AC', textDecoration: 'underline',
            textUnderlineOffset: '3px', marginTop: '4px',
          }}>
            비밀번호를 잊으셨나요?
          </button>
        )}
      </div>
    </div>
  )
}
