'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleAuth() {
    setLoading(true)
    setMessage('')
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setMessage(error.message)
      else setMessage('이메일을 확인해 주세요!')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMessage('이메일 또는 비밀번호가 틀렸어요')
      else router.push('/')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#FAF7F4] flex flex-col justify-center px-6">
      <div className="mb-10">
        <h1 className="text-4xl font-serif text-[#6B1E2E] mb-2">Spenlog</h1>
        <p className="text-sm text-gray-400">AI가 분류해주는 핀터레스트 감성 가계부</p>
      </div>

      <div className="space-y-3">
        <input
          type="email"
          placeholder="이메일"
          className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white text-sm outline-none focus:border-[#6B1E2E]"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="비밀번호"
          className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white text-sm outline-none focus:border-[#6B1E2E]"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
        />
        {message && <p className="text-xs text-[#C4748A] px-1">{message}</p>}
        <button
          onClick={handleAuth}
          disabled={loading}
          className="w-full bg-[#6B1E2E] text-white py-3 rounded-2xl text-sm font-medium disabled:opacity-50"
        >
          {loading ? '처리 중...' : isSignUp ? '회원가입' : '로그인'}
        </button>
        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="w-full text-center text-xs text-gray-400 py-2"
        >
          {isSignUp ? '이미 계정이 있어요 → 로그인' : '처음이에요 → 회원가입'}
        </button>
      </div>
    </div>
  )
}