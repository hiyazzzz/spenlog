'use client'
import { useState } from 'react'
import { TEXTS } from '@/config/texts'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { FixedCost, FixedCostType, FixedCostKind, Account, Card } from '@spenlog/types'

const TYPES: FixedCostType[] = ['월정액', '연정액', '기타']
const KINDS: FixedCostKind[] = ['고정지출', '고정저축']

interface Props {
  initialItems: FixedCost[]
  userId: string
  accounts?: Account[]
  cards?: Card[]
}

type LinkedOption = { id: string; label: string; type: 'account' | 'card' }

export default function FixedCostList({ initialItems, userId, accounts = [], cards = [] }: Props) {
  const router = useRouter()
  const [activeKind, setActiveKind] = useState<FixedCostKind>('고정지출')
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState<FixedCostType>('월정액')
  const [kind, setKind] = useState<FixedCostKind>('고정지출')
  const [dueDay, setDueDay] = useState('')
  const [linkedId, setLinkedId] = useState('')
  const [saving, setSaving] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const linkedOptions: LinkedOption[] = [
    ...accounts.map(a => ({ id: a.id, label: `${a.name}·${a.bank}`, type: 'account' as const })),
    ...cards.map(c => ({ id: c.id, label: `${c.name}·${c.bank}`, type: 'card' as const })),
  ]

  const filtered = initialItems.filter(item => (item.kind ?? '고정지출') === activeKind)
  const totalSpend = initialItems.filter(i => (i.kind ?? '고정지출') === '고정지출').reduce((s, f) => s + f.amount, 0)
  const totalSave = initialItems.filter(i => i.kind === '고정저축').reduce((s, f) => s + f.amount, 0)

  function getLinkedLabel(item: FixedCost): string | null {
    if (item.linked_card_id) {
      const card = cards.find(c => c.id === item.linked_card_id)
      return card ? card.name : null
    }
    if (item.linked_account_id) {
      const acc = accounts.find(a => a.id === item.linked_account_id)
      return acc ? acc.name : null
    }
    return null
  }

  const handleAdd = async () => {
    if (!name.trim() || !amount) return
    setSaving(true)
    const supabase = createClient()
    const selected = linkedOptions.find(o => o.id === linkedId)
    // null 컬럼은 payload에서 제외 — DB에 해당 컬럼이 없으면 42703 에러 방지
    const insertPayload: Record<string, unknown> = {
      user_id: userId,
      name: name.trim(),
      amount: Number(amount.replace(/,/g, '')),
      type,
      kind,
      due_day: dueDay ? Number(dueDay) : null,
    }
    if (selected?.type === 'account') insertPayload.linked_account_id = selected.id
    if (selected?.type === 'card') insertPayload.linked_card_id = selected.id
    const { error } = await supabase.from('fixed_costs').insert(insertPayload)
    if (error) {
      console.error('[FixedCostList] insert error:', error.code, error.message, error.details)
      setAddError(`저장 실패: ${error.message} (${error.code})`)
      setSaving(false)
      return // 에러 시 form 유지
    }
    setAddError(null)
    setName(''); setAmount(''); setDueDay(''); setType('월정액'); setKind(activeKind); setLinkedId('')
    setShowForm(false)
    setSaving(false)
    router.refresh()
  }

  const handleDelete = async (id: string) => {
    const supabase = createClient()
    await supabase.from('fixed_costs').delete().eq('id', id)
    router.refresh()
  }

  return (
    <div>
      <div className="flex gap-2 mb-3">
        {KINDS.map(k => {
          const total = k === '고정지출' ? totalSpend : totalSave
          const selected = activeKind === k
          return (
            <button key={k} onClick={() => setActiveKind(k)} style={{
              flex: 1, padding: '10px 8px', borderRadius: '14px',
              border: selected ? '2px solid var(--color-primary)' : '2px solid #f0f0f0',
              background: selected ? 'var(--color-primary-light)' : '#fafafa',
              cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center',
            }}>
              <p style={{ fontSize: '11px', color: selected ? 'var(--color-primary)' : '#aaa', fontWeight: '600', marginBottom: '2px' }}>{k}</p>
              <p style={{ fontSize: '14px', fontWeight: '700', color: selected ? 'var(--color-accent)' : '#ccc' }}>
                {total.toLocaleString()}원
              </p>
            </button>
          )
        })}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 mb-4 overflow-hidden">
        {filtered.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-8">{TEXTS.fixed.noItems(activeKind)}</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map((item) => {
              const linkedLabel = getLinkedLabel(item)
              return (
                <div key={item.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{item.name}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {item.type}
                      {item.due_day ? ` · ${TEXTS.fixed.dueDateLabel(item.due_day)}` : ''}
                      {linkedLabel ? ` · ${linkedLabel}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: item.kind === '고정저축' ? '#10B981' : '#374151' }}>
                      {item.amount.toLocaleString()}원
                    </span>
                    <button onClick={() => handleDelete(item.id)}
                      className="text-xs text-gray-300 hover:text-rose-400 transition-colors">✕</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showForm ? (
        <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-3">
          <div className="flex gap-2">
            {KINDS.map(k => (
              <button key={k} onClick={() => setKind(k)} style={{
                flex: 1, padding: '8px', borderRadius: '10px', fontSize: '12px', fontWeight: '600',
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                background: kind === k ? 'var(--color-primary)' : '#f0f0f0',
                color: kind === k ? '#fff' : '#888',
              }}>{k}</button>
            ))}
          </div>
          <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
            placeholder={TEXTS.fixed.formNamePh(kind)}
            value={name} onChange={e => setName(e.target.value)} />
          <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
            placeholder={TEXTS.fixed.formAmountPh} type="text" inputMode="numeric"
            value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9]/g, ''))} />
          <div className="flex gap-2">
            {TYPES.map(t => (
              <button key={t} onClick={() => setType(t)}
                className="flex-1 py-1.5 rounded-xl text-xs font-medium transition-colors"
                style={{ background: type === t ? 'var(--color-primary)' : '#f0f0f0', color: type === t ? '#fff' : '#888' }}>
                {t}
              </button>
            ))}
          </div>
          <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
            placeholder={TEXTS.fixed.formDuePh} type="text" inputMode="numeric"
            value={dueDay} onChange={e => setDueDay(e.target.value.replace(/[^0-9]/g, ''))} />
          {linkedOptions.length > 0 && (
            <select
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none bg-white"
              value={linkedId}
              onChange={e => setLinkedId(e.target.value)}
              style={{ fontFamily: 'inherit', color: linkedId ? '#374151' : '#9ca3af' }}
            >
              <option value="">연결 계좌/카드 선택</option>
              {accounts.length > 0 && (
                <optgroup label="계좌">
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name}·{a.bank}</option>
                  ))}
                </optgroup>
              )}
              {cards.length > 0 && (
                <optgroup label="카드">
                  {cards.map(c => (
                    <option key={c.id} value={c.id}>{c.name}·{c.bank}</option>
                  ))}
                </optgroup>
              )}
            </select>
          )}
          <div className="flex gap-2">
            {addError && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 4 }}>{addError}</p>}
            <button onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-xl text-sm bg-gray-100 text-gray-500">{TEXTS.fixed.btnCancel}</button>
            <button onClick={handleAdd} disabled={saving}
              className="flex-1 py-2 rounded-xl text-sm text-white font-medium disabled:opacity-50"
              style={{ background: 'var(--color-primary)' }}>
              {saving ? '저장 중…' : '추가'}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => { setShowForm(true); setKind(activeKind) }}
          className="w-full py-3 rounded-2xl border-2 border-dashed border-gray-200 text-sm text-gray-400"
          style={{ fontFamily: 'inherit' }}>
          + {activeKind} 추가
        </button>
      )}
    </div>
  )
}
