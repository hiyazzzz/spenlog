'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [done, setDone] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  async function handleReset() {
    if (password !== confirm) return
    const { error } = await supabase.auth.updateUser({ password })
    if (!error) {
      setDone(true)
      setTimeout(() => router.push('/'), 2000)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF7F4] flex flex-col justify-center px-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-[#6B1E2E] mb-2">새 비밀번호 설정</h1>
      <p className="text-sm text-gray-400 mb-8">새로 사용할 비밀번호를 입력해줘요</p>

      {done ? (
        <p className="text-emerald-600 font-medium text-sm">✓ 비밀번호가 변경됐어요! 홈으로 이동 중...</p>
      ) : (
        <div className="space-y-3">
          <input
            type="password"
            placeholder="새 비밀번호"
            className="w-full px-4 py-3.5 rounded-2xl border border-gray-200 bg-white text-sm outline-none focus:border-[#6B1E2E]"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <input
            type="password"
            placeholder="비밀번호 확인"
            className="w-full px-4 py-3.5 rounded-2xl border border-gray-200 bg-white text-sm outline-none focus:border-[#6B1E2E]"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {password && confirm && password !== confirm && (
            <p className="text-xs text-rose-400 px-1">비밀번호가 일치하지 않아요</p>
          )}
          <button
            onClick={handleReset}
            disabled={!password || password !== confirm}
            className="w-full bg-[#6B1E2E] text-white py-3.5 rounded-2xl text-sm font-semibold disabled:opacity-40"
          >
            변경하기
          </button>
        </div>
      )}
    </div>
  )
}