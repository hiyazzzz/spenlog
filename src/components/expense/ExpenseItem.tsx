'use client'
import { useState } from 'react'
import dayjs from 'dayjs'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Expense {
  id: string
  name: string
  amount: number
  category: string
  date: string
  payment_method: string | null
}

export default function ExpenseItem({ expense }: { expense: Expense }) {
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
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

  return (
    <div className="flex justify-between items-center py-3 first:pt-0 last:pb-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{expense.name}</p>
        <div className="flex gap-2 mt-0.5 text-[11px] text-gray-400">
          <span>{expense.date ? dayjs(expense.date).format('MM.DD') : ''}</span>
          <span>•</span>
          <span>{expense.category || '미분류'}</span>
          {expense.payment_method && (
            <>
              <span>•</span>
              <span>{expense.payment_method}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 ml-2">
        <span className="text-sm font-bold text-gray-900 whitespace-nowrap">
          -{(expense.amount ?? 0).toLocaleString()}원
        </span>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className={`text-xs px-2 py-1 rounded-lg transition-colors ${
            confirmDelete
              ? 'bg-rose-500 text-white'
              : 'bg-gray-100 text-gray-400 hover:bg-rose-50 hover:text-rose-400'
          }`}
        >
          {deleting ? '…' : confirmDelete ? '확인' : '삭제'}
        </button>
      </div>
    </div>
  )
}
