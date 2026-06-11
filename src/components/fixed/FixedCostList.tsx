'use client'
import { useState } from 'react'
import { TEXTS } from '@/config/texts'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { FixedCost, FixedCostType, FixedCostKind } from '@/types'

const TYPES: FixedCostType[] = ['월정액', '연정액', '기타']
const KINDS: FixedCostKind[] = ['고정지출', '고정저축']

interface Props {
  initialItems: FixedCost[]
  userId: string
}

export default function FixedCostList({ initialItems, userId }: Props) {
  const router = useRouter()
  const [activeKind, setActiveKind] = useState<FixedCostKind>('고정지출')
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState<FixedCostType>('월정액')
  const [kind, setKind] = useState<FixedCostKind>('고정지출')
  const [dueDay, setDueDay] = useState('')
  const [saving, setSaving] = useState(false)

  const filtered = initialItems.filter(item => (item.kind ?? '고정지출') === activeKind)
  const totalSpend = initialItems.filter(i => (i.kind ?? '고정지출') === '고정지출').reduce((s, f) => s + f.amount, 0)
  const totalSave = initialItems.filter(i => i.kind === '고정저축').reduce((s, f) => s + f.amount, 0)

  const handleAdd = async () => {
    if (!name.trim() || !amount) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('fixed_costs').insert({
      user_id: userId,
      name: name.trim(),
      amount: Number(amount.replace(/,/g, '')),
      type,
      kind,
      due_day: dueDay ? Number(dueDay) : null,
    })
    setName(''); setAmount(''); setDueDay(''); setType('월정액'); setKind(activeKind)
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
            {filtered.map((item) => (
              <div key={item.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{item.name}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {item.type}{item.due_day ? ` · ${TEXTS.fixed.dueDateLabel(item.due_day)}` : ''}
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
            ))}
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
          <div className="flex gap-2">
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
