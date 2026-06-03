'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AiInputBox({ userId }: { userId: string }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<any>(null)
  const supabase = createClient()

  async function handleSubmit() {
    if (!text.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/ai-input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = await res.json()
      if (data.result) setPreview(data.result)
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm() {
    if (!preview) return
    await supabase.from('expenses').insert({
      user_id: userId,
      ...preview,
    })
    setPreview(null)
    setText('')
    // 새로고침으로 목록 업데이트
    window.location.reload()
  }

  return (
    <div className="mx-4 mt-4">
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <textarea
          className="w-full text-sm resize-none outline-none text-gray-700 placeholder:text-gray-300"
          rows={2}
          placeholder="오늘 소비 내역을 알려줘!&#10;예) 스타벅스 아아 5500원 카카오페이&#10;예) 편의점 3200원 현금&#10;예) 배달의민족 치킨 18000원 신한카드"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={handleSubmit}
            disabled={loading || !text.trim()}
            className="bg-[#6B1E2E] text-white text-sm px-4 py-2 rounded-xl disabled:opacity-40"
          >
            {loading ? '분석 중...' : 'AI 분류'}
          </button>
        </div>
      </div>

      {/* 미리보기 카드 */}
      {preview && (
        <div className="mt-3 bg-[#F5E8EA] rounded-2xl p-4 border border-[#C4748A]/20">
          <p className="text-xs text-[#C4748A] font-medium mb-2">이렇게 기록할까요?</p>
          <div className="flex justify-between items-center">
            <div>
              <p className="font-semibold text-[#4A1220]">{preview.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {preview.category} · {preview.date} · {preview.payment_method ?? '결제수단 없음'}
              </p>
            </div>
            <p className="text-lg font-bold text-[#6B1E2E]">
              ₩{preview.amount?.toLocaleString()}
            </p>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleConfirm}
              className="flex-1 bg-[#6B1E2E] text-white text-sm py-2 rounded-xl"
            >
              저장
            </button>
            <button
              onClick={() => setPreview(null)}
              className="flex-1 bg-white text-gray-500 text-sm py-2 rounded-xl border border-gray-200"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  )
}