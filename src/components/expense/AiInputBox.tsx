'use client'
import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { CATEGORIES } from '@/lib/themes'

const PAYMENT_METHODS = ['카드', '현금', '카카오페이', '네이버페이', '토스', '계좌이체']

interface CardInfo { name: string; bank: string }
interface PreviewData {
  name: string
  amount: number
  category: string
  payment_method: string | null
  date: string
  memo: string | null
}

export default function AiInputBox({ userId }: { userId: string }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [cards, setCards] = useState<CardInfo[]>([])
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
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
      if (data.result) {
        setPreview(data.result)
        setCards(data.cards ?? [])
        setEditing(false)
      } else {
        setError(data.error || '분류 실패')
      }
    } catch {
      setError('네트워크 오류가 발생했어요')
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
        if (data.result) { setPreview(data.result); setCards(data.cards ?? []) }
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
    setEditing(false)
    router.refresh()
  }

  function updatePreview(key: keyof PreviewData, value: string | number | null) {
    setPreview(prev => prev ? { ...prev, [key]: value } : null)
  }

  // 결제수단 옵션: 등록 카드 + 기본 수단
  const paymentOptions = [
    ...cards.map(c => c.name),
    ...PAYMENT_METHODS.filter(m => !cards.some(c => c.name === m)),
  ]

  return (
    <div>
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <textarea
          className="w-full text-sm resize-none outline-none text-gray-700 placeholder:text-gray-300"
          rows={3}
          placeholder={"오늘 소비 내역을 알려줘!\n예) 아아 삼천원\n예) 편의점 3200원 현금\n예) 배민 치킨 18000원 신한카드"}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey) handleSubmit() }}
        />
        <div className="flex justify-between items-center mt-2">
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
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
            className="hidden" onChange={(e) => e.target.files?.[0] && handleOcr(e.target.files[0])} />
          <button
            onClick={handleSubmit}
            disabled={loading || !text.trim()}
            className="text-white text-sm px-4 py-2 rounded-xl disabled:opacity-40"
            style={{ background: 'var(--color-primary)' }}
          >
            {loading ? '분석 중...' : 'AI 분류'}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-xs text-rose-400 mt-2 px-1">{error}</p>
      )}

      {/* 미리보기 + 수정 카드 */}
      {preview && (
        <div className="mt-3 rounded-2xl p-4 border" style={{ background: 'var(--color-primary-light)', borderColor: 'var(--color-primary-mid)' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium" style={{ color: 'var(--color-primary-mid)' }}>이렇게 기록할까요?</p>
            <button
              onClick={() => setEditing(!editing)}
              className="text-xs px-2 py-1 rounded-lg bg-white border border-gray-200 text-gray-500"
            >
              {editing ? '접기' : '✏️ 수정'}
            </button>
          </div>

          {!editing ? (
            /* 요약 뷰 */
            <div className="flex justify-between items-center">
              <div>
                <p className="font-semibold" style={{ color: 'var(--color-accent)' }}>{preview.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {preview.category} · {preview.date}
                  {preview.payment_method && ` · ${preview.payment_method}`}
                </p>
              </div>
              <p className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>
                {preview.amount?.toLocaleString()}원
              </p>
            </div>
          ) : (
            /* 수정 뷰 */
            <div className="space-y-2">
              {/* 항목명 */}
              <div>
                <label className="text-[10px] text-gray-400 mb-0.5 block">항목명</label>
                <input
                  type="text"
                  value={preview.name}
                  onChange={e => updatePreview('name', e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-xl bg-white border border-gray-200 outline-none"
                />
              </div>
              {/* 금액 */}
              <div>
                <label className="text-[10px] text-gray-400 mb-0.5 block">금액</label>
                <input
                  type="text" inputMode="numeric"
                  value={preview.amount}
                  onChange={e => updatePreview('amount', Number(e.target.value.replace(/[^0-9]/g, '')))}
                  className="w-full text-sm px-3 py-2 rounded-xl bg-white border border-gray-200 outline-none"
                />
              </div>
              {/* 카테고리 */}
              <div>
                <label className="text-[10px] text-gray-400 mb-0.5 block">카테고리</label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map(cat => (
                    <button key={cat} onClick={() => updatePreview('category', cat)}
                      className="text-xs px-3 py-1.5 rounded-full border transition-all"
                      style={{
                        background: preview.category === cat ? 'var(--color-primary)' : 'white',
                        color: preview.category === cat ? 'white' : '#888',
                        borderColor: preview.category === cat ? 'var(--color-primary)' : '#e5e7eb',
                      }}>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              {/* 결제수단 */}
              <div>
                <label className="text-[10px] text-gray-400 mb-0.5 block">결제수단</label>
                <div className="flex flex-wrap gap-1.5">
                  {paymentOptions.slice(0, 6).map(method => (
                    <button key={method} onClick={() => updatePreview('payment_method', method)}
                      className="text-xs px-3 py-1.5 rounded-full border transition-all"
                      style={{
                        background: preview.payment_method === method ? 'var(--color-primary)' : 'white',
                        color: preview.payment_method === method ? 'white' : '#888',
                        borderColor: preview.payment_method === method ? 'var(--color-primary)' : '#e5e7eb',
                      }}>
                      {method}
                    </button>
                  ))}
                  <button onClick={() => updatePreview('payment_method', null)}
                    className="text-xs px-3 py-1.5 rounded-full border transition-all"
                    style={{
                      background: !preview.payment_method ? 'var(--color-primary)' : 'white',
                      color: !preview.payment_method ? 'white' : '#888',
                      borderColor: !preview.payment_method ? 'var(--color-primary)' : '#e5e7eb',
                    }}>
                    없음
                  </button>
                </div>
              </div>
              {/* 날짜 */}
              <div>
                <label className="text-[10px] text-gray-400 mb-0.5 block">날짜</label>
                <input
                  type="date"
                  value={preview.date}
                  onChange={e => updatePreview('date', e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-xl bg-white border border-gray-200 outline-none"
                />
              </div>
            </div>
          )}

          <div className="flex gap-2 mt-3">
            <button onClick={handleConfirm}
              className="flex-1 text-white text-sm py-2 rounded-xl font-medium"
              style={{ background: 'var(--color-primary)' }}>
              저장
            </button>
            <button onClick={() => { setPreview(null); setText(''); setEditing(false) }}
              className="flex-1 bg-white text-gray-500 text-sm py-2 rounded-xl border border-gray-200">
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
