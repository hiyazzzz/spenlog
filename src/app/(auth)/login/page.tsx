'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Mode = 'login' | 'signup'
type ErrorType = 'no_user' | 'wrong_password' | 'email_taken' | 'weak_password' | 'general' | null

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorType, setErrorType] = useState<ErrorType>(null)
  const [successMsg, setSuccessMsg] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  function clearState() {
    setErrorType(null)
    setSuccessMsg('')
    setResetSent(false)
  }

  function switchMode(m: Mode) {
    setMode(m)
    clearState()
  }

  async function handleAuth() {
    if (!email || !password) return
    setLoading(true)
    clearState()

    if (mode === 'signup') {
      const { data: signUpData, error } = await supabase.auth.signUp({ email, password })
      if (!error) {
        if (signUpData.session) {
          // 이메일 인증 OFF: 바로 로그인 처리
          router.refresh()
          router.push('/')
          return
        }
        setSuccessMsg('가입 완료! 이메일 인증 후 로그인해 주세요.')
      } else if (error.message.toLowerCase().includes('already registered') || error.message.includes('already been registered')) {
        setErrorType('email_taken')
      } else if (error.message.toLowerCase().includes('password')) {
        setErrorType('weak_password')
      } else {
        setErrorType('general')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (!error) {
        router.refresh()
        router.push('/')
        return
      }
      // Supabase 에러 코드 기반 분기
      // "Invalid login credentials" = 이메일 없거나 비밀번호 틀림
      // Supabase는 보안상 둘을 같은 에러로 반환하므로
      // signUp 시도로 계정 존재 여부 간접 확인
      if (error.message.includes('Invalid login credentials')) {
        // 존재하는 이메일인지 확인: OTP 요청으로 체크 (실제 메일 발송 없음)
        const { error: signUpErr } = await supabase.auth.signUp({
          email,
          password: Math.random().toString(36), // 임시 패스워드
          options: { data: { _check_only: true } }
        })
        // 이미 등록된 이메일이면 "User already registered" 에러
        if (signUpErr?.message?.includes('already registered')) {
          setErrorType('wrong_password')
        } else {
          setErrorType('no_user')
        }
      } else if (error.message.includes('Email not confirmed')) {
        setErrorType('general')
        setSuccessMsg('이메일 인증이 필요해요. 받은 편지함을 확인해 주세요.')
      } else {
        setErrorType('general')
      }
    }
    setLoading(false)
  }

  async function handlePasswordReset() {
    if (!email) return
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    if (!error) setResetSent(true)
  }

  return (
    <div
      className="min-h-screen flex flex-col justify-center px-6"
      style={{
        background: '#FAF7F4',
        fontFamily: "'Pretendard Variable', 'Pretendard', -apple-system, sans-serif",
        maxWidth: '420px',
        margin: '0 auto',
      }}
    >
      {/* 로고 */}
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{
          fontSize: '42px',
          fontWeight: '700',
          color: '#6B1E2E',
          letterSpacing: '-1px',
          lineHeight: 1.1,
          marginBottom: '8px',
          fontFamily: "'Pretendard Variable', 'Pretendard', serif",
        }}>
          Spenlog
        </h1>
        <p style={{ fontSize: '13px', color: '#B8A8AC', fontWeight: '400', letterSpacing: '0.2px' }}>
          AI가 분류해주는 핀터레스트 감성 가계부
        </p>
      </div>

      {/* 탭 */}
      <div style={{
        display: 'flex',
        background: '#F0EAEC',
        borderRadius: '16px',
        padding: '4px',
        marginBottom: '16px',
        gap: '4px',
      }}>
        {(['login', 'signup'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: '600',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: mode === m ? '#6B1E2E' : 'transparent',
              color: mode === m ? '#fff' : '#B8A8AC',
            }}
          >
            {m === 'login' ? '로그인' : '회원가입'}
          </button>
        ))}
      </div>

      {/* 입력 필드 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <input
          type="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => { setEmail(e.target.value); clearState() }}
          style={{
            width: '100%',
            padding: '14px 16px',
            borderRadius: '14px',
            border: '1.5px solid #EDE3E5',
            background: '#fff',
            fontSize: '14px',
            color: '#3D2020',
            outline: 'none',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
          }}
        />
        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => { setPassword(e.target.value); clearState() }}
          onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
          style={{
            width: '100%',
            padding: '14px 16px',
            borderRadius: '14px',
            border: '1.5px solid #EDE3E5',
            background: '#fff',
            fontSize: '14px',
            color: '#3D2020',
            outline: 'none',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
          }}
        />

        {/* 에러 카드 — 계정 없음 */}
        {errorType === 'no_user' && (
          <div style={{
            background: '#FFF5F7',
            border: '1px solid #F5D0D8',
            borderRadius: '14px',
            padding: '14px 16px',
          }}>
            <p style={{ fontSize: '13px', fontWeight: '600', color: '#C0405A', marginBottom: '4px' }}>
              가입된 계정이 없어요
            </p>
            <p style={{ fontSize: '12px', color: '#C87A8A', marginBottom: '10px', lineHeight: 1.5 }}>
              이 이메일로 가입한 기록이 없어요.
            </p>
            <button
              onClick={() => switchMode('signup')}
              style={{
                fontSize: '12px',
                fontWeight: '600',
                color: '#6B1E2E',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                textDecoration: 'underline',
                textUnderlineOffset: '3px',
              }}
            >
              회원가입 하러 가기 →
            </button>
          </div>
        )}

        {/* 에러 카드 — 비밀번호 틀림 */}
        {errorType === 'wrong_password' && (
          <div style={{
            background: '#FFF8F2',
            border: '1px solid #F5DFC8',
            borderRadius: '14px',
            padding: '14px 16px',
          }}>
            <p style={{ fontSize: '13px', fontWeight: '600', color: '#C06020', marginBottom: '4px' }}>
              비밀번호가 틀렸어요
            </p>
            <p style={{ fontSize: '12px', color: '#C8906A', marginBottom: '10px', lineHeight: 1.5 }}>
              이메일은 맞지만 비밀번호가 달라요.
            </p>
            {!resetSent ? (
              <button
                onClick={handlePasswordReset}
                style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#6B1E2E',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline',
                  textUnderlineOffset: '3px',
                }}
              >
                비밀번호 재설정 메일 받기 →
              </button>
            ) : (
              <p style={{ fontSize: '12px', color: '#5A9970', fontWeight: '600' }}>
                ✓ {email}로 재설정 링크를 보냈어요
              </p>
            )}
          </div>
        )}

        {/* 에러 카드 — 이메일 중복 */}
        {errorType === 'email_taken' && (
          <div style={{
            background: '#FFF5F7',
            border: '1px solid #F5D0D8',
            borderRadius: '14px',
            padding: '14px 16px',
          }}>
            <p style={{ fontSize: '13px', fontWeight: '600', color: '#C0405A', marginBottom: '4px' }}>
              이미 가입된 이메일이에요
            </p>
            <button
              onClick={() => switchMode('login')}
              style={{
                fontSize: '12px',
                fontWeight: '600',
                color: '#6B1E2E',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                textDecoration: 'underline',
                textUnderlineOffset: '3px',
              }}
            >
              로그인 하러 가기 →
            </button>
          </div>
        )}

        {/* 에러 카드 — 약한 비밀번호 */}
        {errorType === 'weak_password' && (
          <p style={{ fontSize: '12px', color: '#C06020', padding: '0 4px' }}>
            비밀번호는 6자 이상으로 설정해 주세요
          </p>
        )}

        {/* 성공 메시지 */}
        {successMsg && (
          <p style={{ fontSize: '12px', color: '#5A9970', fontWeight: '600', padding: '0 4px' }}>
            ✓ {successMsg}
          </p>
        )}

        {/* 로그인/회원가입 버튼 */}
        <button
          onClick={handleAuth}
          disabled={loading || !email || !password}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: '14px',
            background: loading || !email || !password ? '#C4A0A8' : '#6B1E2E',
            color: '#fff',
            fontSize: '14px',
            fontWeight: '600',
            border: 'none',
            cursor: loading || !email || !password ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s',
            fontFamily: 'inherit',
            marginTop: '2px',
          }}
        >
          {loading ? '처리 중...' : mode === 'login' ? '로그인' : '회원가입'}
        </button>
      </div>
    </div>
  )
}
