'use client'
import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function AiInputBox({ userId }: { userId: string }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [preview, setPreview] = useState<any>(null)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit() {
    if (!text.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/ai-input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = await res.json()
      if (data.result) setPreview(data.result)
      else setError(data.error || '분류 실패')
    } catch {
      setError('네트워크 오류')
    } finally {
      setLoading(false)
    }
  }

  async function handleOcr(file: File) {
    setOcrLoading(true)
    setError('')
    try {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string).split(',')[1]
        const mediaType = file.type || 'image/jpeg'
        const res = await fetch('/api/ocr-input', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, mediaType }),
        })
        const data = await res.json()
        if (data.result) setPreview(data.result)
        else setError(data.error || '영수증을 읽을 수 없어요')
        setOcrLoading(false)
      }
      reader.readAsDataURL(file)
    } catch {
      setError('이미지 처리 오류')
      setOcrLoading(false)
    }
  }

  async function handleConfirm() {
    if (!preview) return
    await supabase.from('expenses').insert({ user_id: userId, ...preview })
    setPreview(null)
    setText('')
    router.refresh()
  }

  return (
    <div>
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <textarea
          className="w-full text-sm resize-none outline-none text-gray-700 placeholder:text-gray-300"
          rows={3}
          placeholder={"오늘 소비 내역을 알려줘!\n예) 스타벅스 아아 5500원 카카오페이\n예) 편의점 3200원 현금\n예) 배달의민족 치킨 18000원 신한카드"}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex justify-between items-center mt-2">
          {/* 영수증 스캔 버튼 */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={ocrLoading}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {ocrLoading ? '스캔 중...' : '영수증 스캔'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleOcr(e.target.files[0])}
          />

          <button
            onClick={handleSubmit}
            disabled={loading || !text.trim()}
            className="bg-[#6B1E2E] text-white text-sm px-4 py-2 rounded-xl disabled:opacity-40"
            style={{ background: 'var(--color-primary)' }}
          >
            {loading ? '분석 중...' : 'AI 분류'}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-xs text-rose-400 mt-2 px-1">{error}</p>
      )}

      {/* 미리보기 카드 */}
      {preview && (
        <div className="mt-3 rounded-2xl p-4 border" style={{ background: 'var(--color-primary-light)', borderColor: 'var(--color-primary-mid)' }}>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-primary-mid)' }}>이렇게 기록할까요?</p>
          <div className="flex justify-between items-center">
            <div>
              <p className="font-semibold" style={{ color: 'var(--color-accent)' }}>{preview.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {preview.category} · {preview.date} · {preview.payment_method ?? '결제수단 없음'}
              </p>
            </div>
            <p className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>
              {preview.amount?.toLocaleString()}원
            </p>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={handleConfirm}
              className="flex-1 text-white text-sm py-2 rounded-xl"
              style={{ background: 'var(--color-primary)' }}>
              저장
            </button>
            <button onClick={() => { setPreview(null); setText('') }}
              className="flex-1 bg-white text-gray-500 text-sm py-2 rounded-xl border border-gray-200">
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
