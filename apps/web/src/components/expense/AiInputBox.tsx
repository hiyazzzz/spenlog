'use client'
import { useState, useEffect } from 'react'
import { TEXTS } from '@/config/texts'
import { useAiInputStore } from '@/store/useAiInputStore'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const DEFAULT_CATEGORIES = ['생활비', '활동비', '고정비', '친목비', '예비비', '수입']
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

export default function AiInputBox({ userId, compact, userCategories }: { userId: string; compact?: boolean; userCategories?: string[] }) {
  const cats = userCategories && userCategories.length > 0 ? userCategories : DEFAULT_CATEGORIES
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [previews, setPreviews] = useState<PreviewData[]>([])
  const [error, setError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saveFailCount, setSaveFailCount] = useState(0)
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [failModal, setFailModal] = useState(false)
  const [failMsg, setFailMsg] = useState('')
  // 실패 모달 인라인 입력 상태
  const [inlineForm, setInlineForm] = useState({ name: '', amount: '', category: cats[0] ?? '생활비', payment_method: '' })
  const [inlineSaving, setInlineSaving] = useState(false)
  const [inlineSaved, setInlineSaved] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const { setPrefill } = useAiInputStore()
  const [accounts, setAccounts] = useState<{ id: string; name: string; balance: number }[]>([])
  const [cards, setCards] = useState<{ name: string }[]>([])

  useEffect(() => {
    supabase.from('accounts').select('id, name, balance').then(({ data }) => { if (data) setAccounts(data) })
    supabase.from('cards').select('name').then(({ data }) => { if (data) setCards(data) })
  }, [])

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
        const numMatch = text.match(/(\d[\d,]+)/)
        const nameGuess = text.trim().split(/\s+/)[0]
        setPrefill({
          name: nameGuess || undefined,
          amount: numMatch ? parseInt(numMatch[1].replace(/,/g, '')) : undefined,
          originalText: text,
        })
        setFailMsg(errMsg)
        setFailModal(true)
      }
    } catch {
      setFailMsg(TEXTS.ai.networkError)
      setFailModal(true)
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
            category: p.category === '없음' ? null : p.category,
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
          ? TEXTS.ai.saveErrorPersist
          : TEXTS.ai.saveErrorRetry)
        return
      }
      // 계좌 결제 시 잔액 차감
      const accountMap = new Map(accounts.map(a => [a.name, a]))
      const expensePreviews = previews.filter(p => p.type === 'expense' && p.payment_method && accountMap.has(p.payment_method))
      await Promise.all(expensePreviews.map(async p => {
        const acct = accountMap.get(p.payment_method!)!
        await supabase.from('accounts').update({ balance: (acct.balance || 0) - p.amount }).eq('id', acct.id)
      }))
      setPreviews([])
      setText('')
      setEditingIdx(null)
      setSaveFailCount(0)
      try { localStorage.removeItem('sp_history_v2') } catch {}
      try { localStorage.removeItem('sp_home_v1') } catch {}
      try { localStorage.removeItem('sp_assets_v2') } catch {}
      try { localStorage.setItem('sp_history_needs_refresh', '1') } catch {}
      try { localStorage.setItem('sp_assets_needs_refresh', '1') } catch {}
      router.push('/history')
    } catch {
      const newCount = saveFailCount + 1
      setSaveFailCount(newCount)
      setSaveError(newCount >= 2
        ? TEXTS.ai.saveErrorNetworkPersist
        : TEXTS.ai.saveErrorNetworkRetry)
    } finally {
      setSaving(false)
    }
  }


  async function handleInlineSave() {
    const amount = parseInt(inlineForm.amount.replace(/,/g, ''))
    if (!inlineForm.name.trim() || !amount) return
    setInlineSaving(true)
    try {
      const { error: saveErr } = await supabase.from('expenses').insert({
        user_id: userId, name: inlineForm.name.trim(), amount,
        category: inlineForm.category === '없음' ? null : inlineForm.category, date: new Date().toISOString().split('T')[0],
        payment_method: inlineForm.payment_method, source: 'manual', type: 'expense',
      })
      if (!saveErr) {
        // 계좌 결제 시 잔액 차감
        const acct = accounts.find(a => a.name === inlineForm.payment_method)
        if (acct) {
          await supabase.from('accounts').update({ balance: (acct.balance || 0) - amount }).eq('id', acct.id)
        }
        setInlineSaved(true)
        setTimeout(() => {
          setFailModal(false)
          setInlineSaved(false)
          setInlineForm({ name: '', amount: '', category: cats[0] ?? '생활비', payment_method: '' })
          try { localStorage.removeItem('sp_history_v2') } catch {}
          try { localStorage.removeItem('sp_home_v1') } catch {}
          try { localStorage.removeItem('sp_assets_v2') } catch {}
          try { localStorage.setItem('sp_history_needs_refresh', '1') } catch {}
          try { localStorage.setItem('sp_assets_needs_refresh', '1') } catch {}
          router.push('/history')
        }, 1000)
      }
    } catch { /* ignore */ }
    finally { setInlineSaving(false) }
  }

  function updatePreview(idx: number, key: keyof PreviewData, value: string | number | null) {
    setPreviews(prev => prev.map((p, i) => i === idx ? { ...p, [key]: value } : p))
  }
  function removePreview(idx: number) {
    setPreviews(prev => prev.filter((_, i) => i !== idx))
  }

  return (
    <div>
      {/* AI 실패 모달 */}
      {failModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end',
        }}>
          <div style={{
            width: '100%', background: '#fff', borderRadius: '20px 20px 0 0',
            padding: '24px 20px 40px', maxHeight: '90vh', overflowY: 'auto',
          }}>
            {/* 핸들 */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: '#e5e7eb' }} />
            </div>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <p style={{ fontSize: 20, marginBottom: 6 }}>😅</p>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#1f2937', marginBottom: 4 }}>{TEXTS.ai.failTitle}</p>
              <p style={{ fontSize: 13, color: '#9ca3af' }}>{TEXTS.ai.failSubtitle}</p>
            </div>

            {/* 인라인 입력 폼 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {/* 금액 */}
              <div style={{ background: '#f9fafb', borderRadius: 12, padding: '12px 14px' }}>
                <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>{TEXTS.ai.inlineAmount}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input
                    type="text" inputMode="numeric" autoFocus
                    placeholder={TEXTS.ai.inlineAmountPlaceholder}
                    value={inlineForm.amount ? Number(inlineForm.amount.replace(/,/g,'')).toLocaleString() : ''}
                    onChange={e => setInlineForm(p => ({ ...p, amount: e.target.value.replace(/[^0-9]/g,'') }))}
                    style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 18, fontWeight: 700, outline: 'none', fontFamily: 'inherit', color: '#1f2937' }}
                  />
                </div>
              </div>
              {/* 항목명 */}
              <div style={{ background: '#f9fafb', borderRadius: 12, padding: '12px 14px' }}>
                <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>{TEXTS.ai.inlineName}</p>
                <input
                  type="text" placeholder={TEXTS.ai.inlineNamePlaceholder}
                  value={inlineForm.name}
                  onChange={e => setInlineForm(p => ({ ...p, name: e.target.value }))}
                  style={{ width: '100%', border: 'none', background: 'transparent', fontSize: 14, outline: 'none', fontFamily: 'inherit', color: '#1f2937' }}
                />
              </div>
              {/* 카테고리 */}
              <div>
                <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6 }}>카테고리</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {[...cats.filter(c => c !== '수입'), '없음'].map(cat => (
                    <button key={cat}
                      onClick={() => setInlineForm(p => ({ ...p, category: cat }))}
                      style={{
                        padding: '6px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
                        background: inlineForm.category === cat ? 'var(--color-primary)' : '#f3f4f6',
                        color: inlineForm.category === cat ? '#fff' : '#6b7280',
                        fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
                      }}>{cat}</button>
                  ))}
                </div>
              </div>
              {/* 결제수단 */}
              <div>
                <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6 }}>결제수단</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {PAYMENT_METHODS.slice(0, 4).map(m => (
                    <button key={m}
                      onClick={() => setInlineForm(p => ({ ...p, payment_method: m }))}
                      style={{
                        padding: '6px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
                        background: inlineForm.payment_method === m ? 'var(--color-primary)' : '#f3f4f6',
                        color: inlineForm.payment_method === m ? '#fff' : '#6b7280',
                        fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
                      }}>{m}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* 저장 버튼 */}
            <button
              onClick={handleInlineSave}
              disabled={inlineSaving || inlineSaved || !inlineForm.name.trim() || !inlineForm.amount}
              style={{
                width: '100%', padding: '14px', borderRadius: 14, border: 'none',
                background: inlineSaved ? '#059669' : 'var(--color-primary)', color: '#fff',
                fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 10,
                opacity: (!inlineForm.name.trim() || !inlineForm.amount) ? 0.5 : 1,
              }}
            >{inlineSaved ? TEXTS.ai.failSaved : inlineSaving ? TEXTS.ai.failSaving : TEXTS.ai.failBtnSave}</button>
            <button
              onClick={() => setFailModal(false)}
              style={{
                width: '100%', padding: '12px', borderRadius: 14,
                background: '#f3f4f6', color: '#6b7280',
                fontSize: 14, fontWeight: 500, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >다시 시도</button>
          </div>
        </div>
      )}


      <div className={compact ? '' : 'bg-white rounded-2xl border border-gray-100 p-4 shadow-sm'}>
        <textarea
          className="w-full text-sm resize-none outline-none text-gray-700 placeholder:text-gray-300"
          rows={compact ? 2 : 3}
          placeholder={compact ? TEXTS.ai.placeholder : TEXTS.ai.placeholderFull}
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
            {loading ? TEXTS.ai.btnAnalyzing : TEXTS.ai.btnAnalyze}
          </button>
        </div>
      </div>


      {previews.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-medium px-1" style={{ color: 'var(--color-primary-mid)' }}>
            {TEXTS.ai.recognized(previews.length)}
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
                    {editingIdx === idx ? TEXTS.ai.btnFold : TEXTS.ai.btnEdit}
                  </button>
                  <button onClick={() => removePreview(idx)}
                    className="text-xs px-2 py-1 rounded-lg bg-white border border-gray-200 text-gray-400">{TEXTS.ai.btnDelete}</button>
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
                    {preview.type === 'income' ? '+' : ''}{preview.amount?.toLocaleString()}원
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
                        {t === 'expense' ? TEXTS.ai.labelExpense : TEXTS.ai.labelIncome}
                      </button>
                    ))}
                  </div>
                  <input type="text" value={preview.name}
                    onChange={e => updatePreview(idx, 'name', e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded-xl bg-white border border-gray-200 outline-none" />
                  <input type="text" inputMode="numeric" value={preview.amount}
                    onChange={e => updatePreview(idx, 'amount', Number(e.target.value.replace(/[^0-9]/g, '')))}
                    className="w-full text-sm px-3 py-2 rounded-xl bg-white border border-gray-200 outline-none" />
                  {preview.type === 'expense' ? (
                    <div>
                      <p className="text-xs font-semibold mb-1.5" style={{ color: '#6366f1' }}>{TEXTS.ai.labelCategory}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {[...cats.filter(c => c !== '수입'), '없음'].map(cat => (
                          <button key={cat} onClick={() => updatePreview(idx, 'category', cat)}
                            className="text-xs px-3 py-1.5 rounded-full border transition-all"
                            style={{
                              background: preview.category === cat ? '#6366f1' : '#eef2ff',
                              color: preview.category === cat ? 'white' : '#6366f1',
                              borderColor: preview.category === cat ? '#6366f1' : '#e0e7ff',
                            }}>
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-semibold mb-1.5" style={{ color: '#059669' }}>{TEXTS.ai.labelIncomeSource}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {[...accounts.map(a => a.name), '현금', '계좌이체'].map(method => (
                          <button key={method} onClick={() => updatePreview(idx, 'payment_method', method)}
                            className="text-xs px-3 py-1.5 rounded-full border transition-all"
                            style={{
                              background: preview.payment_method === method ? '#059669' : '#f0fdf4',
                              color: preview.payment_method === method ? 'white' : '#059669',
                              borderColor: preview.payment_method === method ? '#059669' : '#bbf7d0',
                            }}>
                            {method}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {preview.type === 'expense' && (
                    <div>
                      <p className="text-xs font-semibold mb-1.5" style={{ color: '#059669' }}>{TEXTS.ai.labelPaymentExpense}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {[...accounts.map(a => a.name), ...cards.map(c => c.name), '현금', '카카오페이', '네이버페이'].map(method => (
                          <button key={method} onClick={() => updatePreview(idx, 'payment_method', method)}
                            className="text-xs px-3 py-1.5 rounded-full border transition-all"
                            style={{
                              background: preview.payment_method === method ? '#059669' : '#f0fdf4',
                              color: preview.payment_method === method ? 'white' : '#059669',
                              borderColor: preview.payment_method === method ? '#059669' : '#bbf7d0',
                            }}>
                            {method}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
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
              {saving ? TEXTS.ai.btnSaving : saveError ? TEXTS.ai.btnRetry : previews.length > 1 ? TEXTS.ai.btnSaveAll(previews.length) : TEXTS.ai.btnSave}
            </button>
            <button
              onClick={() => { setPreviews([]); setText(''); setEditingIdx(null); setSaveError(''); setSaveFailCount(0) }}
              className="flex-1 bg-white text-gray-500 text-sm py-2.5 rounded-xl border border-gray-200"
            >
              {TEXTS.ai.btnCancel}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
