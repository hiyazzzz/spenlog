'use client'
import { useState } from 'react'
import AddExpenseForm from './AddExpenseForm'
import ExpenseFilter from './ExpenseFilter'

interface Expense {
  id: string
  name: string
  amount: number
  category: string
  date: string
  payment_method: string | null
}

export default function AddTabs({ expenses }: { expenses: Expense[] }) {
  const [tab, setTab] = useState<'add' | 'list'>('add')

  return (
    <div>
      {/* 탭 */}
      <div className="flex bg-white rounded-2xl border border-gray-100 p-1 mb-5">
        {(['add', 'list'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
              tab === t ? 'bg-[#6B1E2E] text-white' : 'text-gray-400'
            }`}
          >
            {t === 'add' ? '✏️ 기록하기' : '📋 전체 내역'}
          </button>
        ))}
      </div>

      {tab === 'add' ? (
        <AddExpenseForm />
      ) : (
        <ExpenseFilter expenses={expenses} />
      )}
    </div>
  )
}
