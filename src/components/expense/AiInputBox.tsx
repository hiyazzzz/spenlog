'use client'
import { useState } from 'react'
import { useAiInputStore } from '@/store/useAiInputStore'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { CATEGORIES } from '@/lib/themes'

const PAYMENT_METHODS = ['카드', '현금', '카카오페이', '네이버페이', '토스', '계좌이체']

interface PreviewData {
  name: string
  amount: number
  category: string
  payment_method: string | null
  date: string
  memo: string | null
  type: 'expense' | 'income'
}

export default function AiInputBox({ userId, compact }: { userId: string; compact?: boolean }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [previews, setPreviews] = useState<PreviewData[]>([])
  const [error, setError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saveFailCount, setSaveFailCount] = useState(0)
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const router = useRouter()
  const supabase = createClient()
  const { setPrefill } = useAiInputStore()

  async function handleSubmit() {
    if (!text.trim()) return
    setLoading(true)
    setError('')
    setSaveError('')
    setSaveFailCount(0)
    try {
      const res = await fetch('/api/ai-input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = await res.json()
      if (data.items && data.items.length > 0) {
        setPreviews(data.items)
        setEditingIdx(null)
      } else {
        const errMsg = data.error || '분류 실패'
        setError(errMsg + ' — 직접 입력할게요')
        const numMatch = text.match(/(\d[\d,]+)/)
        const nameGuess = text.trim().split(/\s+/)[0]
        setPrefill({
          name: nameGuess || undefined,
          amount: numMatch ? parseInt(numMatch[1].replace(/,/g, '')) : undefined,
          originalText: text,
        })
        setTimeout(() => router.push('/add'), 1200)
      }
    } catch {
      setError('네트워크 오류 — 직접 입력할게요')
      setTimeout(() => router.push('/add'), 1200)
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirmAll() {
    if (previews.length === 0 || saving) return
    setSaving(true)
    setSaveError('')
    try {
      const results = await Promise.all(
        previews.map(p =>
          supabase.from('expenses').insert({
            user_id: userId,
            name: p.name,
            amount: p.amount,
            category: p.category,
            date: p.date,
            payment_method: p.payment_method,
            memo: p.memo,
            type: p.type,
            source: 'ai_input',
          })
        )
      )
      const failed = results.filter(r => r.error)
      if (failed.length > 0) {
        console.error('[AiInput save error]', failed[0].error)
        const newCount = saveFailCount + 1
        setSaveFailCount(newCount)
        setSaveError(newCount >= 2
          ? '저장에 계속 실패하고 있어요. 직접 입력 탭을 이용해주세요.'
          : '저장 중 오류가 발생했어요.')
        return
      }
      setPreviews([])
      setText('')
      setEditingIdx(null)
      setSaveFailCount(0)
      router.push('/history')
    } catch {
      const newCount = saveFailCount + 1
      setSaveFailCount(newCount)
      setSaveError(newCount >= 2
        ? '저장에 계속 실패하고 있어요. 직접 입력 탭을 이용해주세요.'
        : '네트워크 오류가 발생했어요.')
    } finally {
      setSaving(false)
    }
  }

  function updatePreview(idx: number, key: keyof PreviewData, value: string | number | null) {
    setPreviews(prev => prev.map((p, i) => i === idx ? { ...p, [key]: value } : p))
  }
  function removePreview(idx: number) {
    setPreviews(prev => prev.filter((_, i) => i !== idx))
  }

  return (
    <div>
      <div className={compact ? '' : 'bg-white rounded-2xl border border-gray-100 p-4 shadow-sm'}>
        <textarea
          className="w-full text-sm resize-none outline-none text-gray-700 placeholder:text-gray-300"
          rows={compact ? 2 : 3}
          placeholder={compact ? '오늘 소비 내역을 알려줘!' : '오늘 소비 내역을 알려줘!\n예) 아아 삼천원\n예) 스벅 6천원 배민 치킨 18000원'}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleSubmit() }}
        />
        <div className="flex justify-end items-center mt-2">
          <button
            onClick={handleSubmit}
            disabled={loading || !text.trim()}
            className="text-white text-sm px-3 py-1.5 rounded-xl disabled:opacity-40 flex items-center gap-1.5"
            style={{ background: 'var(--color-primary)', fontSize: compact ? 12 : 14 }}
          >
            {loading && (
              <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {loading ? '분석 중' : 'AI 분류'}
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
              style={{
                background: preview.type === 'income' ? '#f0fdf4' : 'var(--color-primary-light)',
                borderColor: preview.type === 'income' ? '#bbf7d0' : 'var(--color-primary-mid)',
              }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-400">#{idx + 1}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                    preview.type === 'income' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-50 text-rose-400'
                  }`}>
                    {preview.type === 'income' ? '수입' : '지출'}
                  </span>
                </div>
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
                  <p className={`text-lg font-bold ${preview.type === 'income' ? 'text-emerald-600' : ''}`}
                    style={preview.type !== 'income' ? { color: 'var(--color-primary)' } : undefined}>
                    {preview.type === 'income' ? '+' : ''}₩{preview.amount?.toLocaleString()}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex bg-gray-100 rounded-xl p-0.5">
                    {(['expense', 'income'] as const).map(t => (
                      <button key={t} onClick={() => updatePreview(idx, 'type', t)}
                        className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors"
                        style={{
                          background: preview.type === t ? 'var(--color-primary)' : 'transparent',
                          color: preview.type === t ? 'white' : '#9ca3af',
                        }}>
                        {t === 'expense' ? '지출' : '수입'}
                      </button>
                    ))}
                  </div>
                  <input type="text" value={preview.name}
                    onChange={e => updatePreview(idx, 'name', e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded-xl bg-white border border-gray-200 outline-none" />
                  <input type="text" inputMode="numeric" value={preview.amount}
                    onChange={e => updatePreview(idx, 'amount', Number(e.target.value.replace(/[^0-9]/g, '')))}
                    className="w-full text-sm px-3 py-2 rounded-xl bg-white border border-gray-200 outline-none" />
                  {preview.type === 'expense' && (
                    <div className="flex flex-wrap gap-1.5">
                      {(CATEGORIES as readonly string[]).map(cat => (
                        <button key={cat} onClick={() => updatePreview(idx, 'category', cat)}
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
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {PAYMENT_METHODS.slice(0, 5).map(method => (
                      <button key={method} onClick={() => updatePreview(idx, 'payment_method', method)}
                        className="text-xs px-3 py-1.5 rounded-full border transition-all"
                        style={{
                          background: preview.payment_method === method ? 'var(--color-primary)' : 'white',
                          color: preview.payment_method === method ? 'white' : '#888',
                          borderColor: preview.payment_method === method ? 'var(--color-primary)' : '#e5e7eb',
                        }}>
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

          {saveError && (
            <div className="px-1">
              <p className="text-xs text-rose-400">{saveError}</p>
              {saveFailCount >= 2 && (
                <a href="/add" className="text-xs font-semibold mt-1 block"
                  style={{ color: 'var(--color-primary)' }}>
                  직접 입력하러 가기 →
                </a>
              )}
            </div>
          )}

          <div className="flex gap-2 mt-1">
            <button
              onClick={handleConfirmAll}
              disabled={saving}
              className="flex-1 text-white text-sm py-2.5 rounded-xl font-medium disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ background: 'var(--color-primary)' }}
            >
              {saving && (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {saving ? '저장 중...' : saveError ? '다시 시도' : previews.length > 1 ? previews.length + '건 전체 저장' : '저장'}
            </button>
            <button
              onClick={() => { setPreviews([]); setText(''); setEditingIdx(null); setSaveError(''); setSaveFailCount(0) }}
              className="flex-1 bg-white text-gray-500 text-sm py-2.5 rounded-xl border border-gray-200"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
