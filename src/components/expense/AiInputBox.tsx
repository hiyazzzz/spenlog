'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { CATEGORIES } from '@/lib/themes'

const PAYMENT_METHODS = ['카드', '현금', '카카오페이', '네이버페이', '토스', '계좌이체']

interface CardInfo { name: string; bank: string }
interface PreviewData {
  name: string; amount: number; category: string
  payment_method: string | null; date: string; memo: string | null
}

export default function AiInputBox({ userId }: { userId: string }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [previews, setPreviews] = useState<PreviewData[]>([])
  const [cards, setCards] = useState<CardInfo[]>([])
  const [error, setError] = useState('')
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
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
      if (data.results && data.results.length > 0) {
        setPreviews(data.results)
        setCards(data.cards ?? [])
        setEditingIdx(null)
      } else {
        const errMsg = data.error || '분류 실패'
        setError(errMsg + ' — 직접 입력할게요')
        setTimeout(() => {
          const params = new URLSearchParams()
          const numMatch = text.match(/(\d[\d,]+)/)
          if (numMatch) params.set('amount', numMatch[1].replace(/,/g, ''))
          const nameGuess = text.split(/\s+/)[0]
          if (nameGuess) params.set('name', nameGuess)
          router.push('/add?' + params.toString())
        }, 1200)
      }
    } catch {
      setError('네트워크 오류 — 직접 입력할게요')
      setTimeout(() => router.push('/add'), 1200)
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirmAll() {
    if (previews.length === 0) return
    await Promise.all(previews.map(p => supabase.from('expenses').insert({ user_id: userId, ...p })))
    setPreviews([])
    setText('')
    setEditingIdx(null)
    router.refresh()
  }

  function updatePreview(idx: number, key: keyof PreviewData, value: string | number | null) {
    setPreviews(prev => prev.map((p, i) => i === idx ? { ...p, [key]: value } : p))
  }
  function removePreview(idx: number) {
    setPreviews(prev => prev.filter((_, i) => i !== idx))
  }

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
          placeholder={'오늘 소비 내역을 알려줘!\n예) 아아 삼천원\n예) 스벅 6천원 배민 치킨 18000원'}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleSubmit() }}
        />
        <div className="flex justify-end items-center mt-2">
          <button onClick={handleSubmit} disabled={loading || !text.trim()}
            className="text-white text-sm px-4 py-2 rounded-xl disabled:opacity-40"
            style={{ background: 'var(--color-primary)' }}>
            {loading ? '분석 중...' : 'AI 분류'}
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-rose-400 mt-2 px-1">{error}</p>}
      {previews.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-medium px-1" style={{ color: 'var(--color-primary-mid)' }}>
            {previews.length}건 인식됨 — 확인 후 저장하세요
          </p>
          {previews.map((preview, idx) => (
            <div key={idx} className="rounded-2xl p-4 border"
              style={{ background: 'var(--color-primary-light)', borderColor: 'var(--color-primary-mid)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400">#{idx + 1}</span>
                <div className="flex gap-2">
                  <button onClick={() => setEditingIdx(editingIdx === idx ? null : idx)}
                    className="text-xs px-2 py-1 rounded-lg bg-white border border-gray-200 text-gray-500">
                    {editingIdx === idx ? '접기' : '✏️ 수정'}
                  </button>
                  <button onClick={() => removePreview(idx)}
                    className="text-xs px-2 py-1 rounded-lg bg-white border border-gray-200 text-gray-400">삭제</button>
                </div>
              </div>
              {editingIdx !== idx ? (
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold" style={{ color: 'var(--color-accent)' }}>{preview.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {preview.category} · {preview.date}
                      {preview.payment_method && ' · ' + preview.payment_method}
                    </p>
                  </div>
                  <p className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>
                    ₩{preview.amount?.toLocaleString()}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <input type="text" value={preview.name}
                    onChange={e => updatePreview(idx, 'name', e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded-xl bg-white border border-gray-200 outline-none" />
                  <input type="text" inputMode="numeric" value={preview.amount}
                    onChange={e => updatePreview(idx, 'amount', Number(e.target.value.replace(/[^0-9]/g, '')))}
                    className="w-full text-sm px-3 py-2 rounded-xl bg-white border border-gray-200 outline-none" />
                  <div className="flex flex-wrap gap-1.5">
                    {(CATEGORIES as readonly string[]).map(cat => (
                      <button key={cat} onClick={() => updatePreview(idx, 'category', cat)}
                        className="text-xs px-3 py-1.5 rounded-full border transition-all"
                        style={{ background: preview.category === cat ? 'var(--color-primary)' : 'white', color: preview.category === cat ? 'white' : '#888', borderColor: preview.category === cat ? 'var(--color-primary)' : '#e5e7eb' }}>
                        {cat}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {paymentOptions.slice(0, 5).map(method => (
                      <button key={method} onClick={() => updatePreview(idx, 'payment_method', method)}
                        className="text-xs px-3 py-1.5 rounded-full border transition-all"
                        style={{ background: preview.payment_method === method ? 'var(--color-primary)' : 'white', color: preview.payment_method === method ? 'white' : '#888', borderColor: preview.payment_method === method ? 'var(--color-primary)' : '#e5e7eb' }}>
                        {method}
                      </button>
                    ))}
                  </div>
                  <input type="date" value={preview.date}
                    onChange={e => updatePreview(idx, 'date', e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded-xl bg-white border border-gray-200 outline-none" />
                </div>
              )}
            </div>
          ))}
          <div className="flex gap-2 mt-1">
            <button onClick={handleConfirmAll}
              className="flex-1 text-white text-sm py-2.5 rounded-xl font-medium"
              style={{ background: 'var(--color-primary)' }}>
              {previews.length > 1 ? previews.length + '건 전체 저장' : '저장'}
            </button>
            <button onClick={() => { setPreviews([]); setText(''); setEditingIdx(null) }}
              className="flex-1 bg-white text-gray-500 text-sm py-2.5 rounded-xl border border-gray-200">
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
