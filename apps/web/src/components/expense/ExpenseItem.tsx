'use client'
import { useState } from 'react'
import dayjs from 'dayjs'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const DEFAULT_CATEGORIES = ['생활비', '활동비', '고정비', '친목비', '예비비', '수입']

interface Expense {
  id: string
  name: string
  amount: number
  category: string
  date: string
  payment_method: string | null
  type?: 'expense' | 'income'
}

interface Props {
  expense: Expense
  userCategories?: string[]
}

export default function ExpenseItem({ expense, userCategories }: Props) {
  const cats = userCategories && userCategories.length > 0 ? userCategories : DEFAULT_CATEGORIES
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: expense.name,
    amount: String(expense.amount),
    category: expense.category,
  })
  const router = useRouter()

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      setTimeout(() => setConfirmDelete(false), 3000)
      return
    }
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('expenses').delete().eq('id', expense.id)
    router.refresh()
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.amount) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('expenses').update({
      name: form.name.trim(),
      amount: parseInt(form.amount),
      category: form.category,
    }).eq('id', expense.id)
    setSaving(false)
    setMode('view')
    router.refresh()
  }

  if (mode === 'edit') {
    return (
      <div className="py-3">
        <div className="space-y-2">
          <input
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#6B1E2E]"
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            placeholder="항목명"
          />
          <div className="flex gap-2">
            <input
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#6B1E2E]"
              type="number"
              value={form.amount}
              onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
              placeholder="금액"
            />
            <select
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#6B1E2E] bg-white"
              value={form.category}
              onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
            >
              {cats.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setMode('view')}
              className="flex-1 py-1.5 rounded-lg text-xs bg-gray-100 text-gray-500">취소</button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-1.5 rounded-lg text-xs bg-[#6B1E2E] text-white disabled:opacity-50">
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const isIncome = expense.type === 'income'

  return (
    <div className="flex justify-between items-center py-3 first:pt-0 last:pb-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-gray-800 truncate">{expense.name}</p>
          {isIncome && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-semibold flex-shrink-0">수입</span>
          )}
        </div>
        <div className="flex gap-2 mt-0.5 text-[11px] text-gray-400">
          <span>{expense.date ? dayjs(expense.date).format('MM.DD') : ''}</span>
          <span>•</span>
          <span>{expense.category || '미분류'}</span>
          {expense.payment_method && <><span>•</span><span>{expense.payment_method}</span></>}
        </div>
      </div>
      <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
        <span className={`text-sm font-bold whitespace-nowrap ${isIncome ? 'text-emerald-500' : 'text-rose-400'}`}>
          {isIncome ? '+' : '-'}{(expense.amount ?? 0).toLocaleString()}원
        </span>
        <button onClick={() => setMode('edit')}
          className="text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-400 hover:bg-blue-50 hover:text-blue-400 transition-colors">
          수정
        </button>
        <button onClick={handleDelete} disabled={deleting}
          className={`text-xs px-2 py-1 rounded-lg transition-colors ${
            confirmDelete ? 'bg-rose-500 text-white' : 'bg-gray-100 text-gray-400 hover:bg-rose-50 hover:text-rose-400'
          }`}>
          {deleting ? '…' : confirmDelete ? '확인' : '삭제'}
        </button>
      </div>
    </div>
  )
}
