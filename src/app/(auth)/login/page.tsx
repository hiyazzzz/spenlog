'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Mode = 'login' | 'signup'
type ErrorType = 'no_user' | 'wrong_password' | 'general' | null

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorType, setErrorType] = useState<ErrorType>(null)
  const [message, setMessage] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  function reset() {
    setErrorType(null)
    setMessage('')
    setResetSent(false)
  }

  async function handleAuth() {
    if (!email || !password) return
    setLoading(true)
    reset()

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setErrorType('general')
        setMessage(error.message)
      } else {
        setMessage('가입 완료! 이메일을 확인해 주세요.')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (!error) {
        router.push('/')
        return
      }
      // 에러 분기
      if (error.message.includes('Invalid login credentials')) {
        // 계정 존재 여부 확인
        const { data } = await supabase
          .from('users')
          .select('id')
          .eq('email', email)
          .maybeSingle()

        if (!data) {
          setErrorType('no_user')
        } else {
          setErrorType('wrong_password')
        }
      } else {
        setErrorType('general')
        setMessage(error.message)
      }
    }
    setLoading(false)
  }

  async function handlePasswordReset() {
    if (!email) {
      setMessage('이메일을 먼저 입력해줘요')
      return
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    if (!error) setResetSent(true)
  }

  return (
    <div className="min-h-screen bg-[#FAF7F4] flex flex-col justify-center px-6 max-w-md mx-auto">

      {/* 로고 */}
      <div className="mb-10">
        <h1 className="text-5xl font-bold text-[#6B1E2E] mb-2 tracking-tight">Spenlog</h1>
        <p className="text-sm text-gray-400 font-light">AI가 분류해주는 핀터레스트 감성 가계부</p>
      </div>

      {/* 탭 */}
      <div className="flex bg-white rounded-2xl p-1 border border-gray-100 mb-5">
        {(['login', 'signup'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); reset() }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all
              ${mode === m
                ? 'bg-[#6B1E2E] text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-600'}`}
          >
            {m === 'login' ? '로그인' : '회원가입'}
          </button>
        ))}
      </div>

      {/* 입력 폼 */}
      <div className="space-y-3">
        <input
          type="email"
          placeholder="이메일"
          className="w-full px-4 py-3.5 rounded-2xl border border-gray-200 bg-white text-sm outline-none focus:border-[#6B1E2E] transition-colors"
          value={email}
          onChange={(e) => { setEmail(e.target.value); reset() }}
        />
        <input
          type="password"
          placeholder="비밀번호"
          className="w-full px-4 py-3.5 rounded-2xl border border-gray-200 bg-white text-sm outline-none focus:border-[#6B1E2E] transition-colors"
          value={password}
          onChange={(e) => { setPassword(e.target.value); reset() }}
          onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
        />

        {/* 에러/메시지 영역 */}
        {errorType === 'no_user' && (
          <div className="bg-[#FFF5F5] border border-rose-100 rounded-2xl p-4">
            <p className="text-sm text-rose-500 font-medium mb-1">가입된 계정이 없어요</p>
            <p className="text-xs text-rose-400">이 이메일로 가입한 기록이 없어요. 회원가입 탭에서 새로 만들어줘요.</p>
            <button
              onClick={() => { setMode('signup'); reset() }}
              className="mt-2 text-xs text-[#6B1E2E] font-semibold underline underline-offset-2"
            >
              회원가입 하러 가기 →
            </button>
          </div>
        )}

        {errorType === 'wrong_password' && (
          <div className="bg-[#FFF9F5] border border-orange-100 rounded-2xl p-4">
            <p className="text-sm text-orange-500 font-medium mb-1">비밀번호가 틀렸어요</p>
            <p className="text-xs text-orange-400 mb-3">이메일은 맞는데 비밀번호가 달라요.</p>
            <div className="flex gap-3">
              <button
                onClick={handlePasswordReset}
                className="text-xs text-[#6B1E2E] font-semibold underline underline-offset-2"
              >
                비밀번호 재설정 메일 받기
              </button>
            </div>
            {resetSent && (
              <p className="text-xs text-emerald-600 mt-2 font-medium">
                ✓ {email}로 재설정 링크를 보냈어요
              </p>
            )}
          </div>
        )}

        {errorType === 'general' && message && (
          <p className="text-xs text-rose-400 px-1">{message}</p>
        )}

        {!errorType && message && (
          <p className="text-xs text-emerald-600 px-1 font-medium">{message}</p>
        )}

        <button
          onClick={handleAuth}
          disabled={loading || !email || !password}
          className="w-full bg-[#6B1E2E] text-white py-3.5 rounded-2xl text-sm font-semibold disabled:opacity-40 transition-opacity mt-1"
        >
          {loading ? '처리 중...' : mode === 'login' ? '로그인' : '회원가입'}
        </button>
      </div>
    </div>
  )
}