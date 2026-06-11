'use client'
import { useState, useMemo } from 'react'
import dayjs from 'dayjs'
import ExpenseItem from './ExpenseItem'

interface Expense {
  id: string
  name: string
  amount: number
  category: string
  date: string
  payment_method: string | null
}

const DEFAULT_CATEGORIES = ['생활비', '활동비', '고정비', '친목비', '예비비', '수입']

interface Props {
  expenses: Expense[]
  userCategories?: string[]
}

export default function ExpenseFilter({ expenses, userCategories }: Props) {
  const [query, setQuery] = useState('')
  const [selectedCat, setSelectedCat] = useState<string>('전체')

  const baseCats = userCategories && userCategories.length > 0 ? userCategories : DEFAULT_CATEGORIES
  const cats = ['전체', ...baseCats]

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      const matchCat = selectedCat === '전체' || e.category === selectedCat
      const matchQuery =
        !query.trim() ||
        e.name.toLowerCase().includes(query.trim().toLowerCase())
      return matchCat && matchQuery
    })
  }, [expenses, query, selectedCat])

  const total = filtered.reduce((s, e) => s + e.amount, 0)

  return (
    <div>
      {/* 검색 */}
      <div className="relative mb-3">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-sm">🔍</span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="지출 항목 검색"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#6B1E2E] bg-white"
        />
      </div>

      {/* 카테고리 필터 */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-4 no-scrollbar">
        {cats.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCat(cat)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              selectedCat === cat
                ? 'bg-[#6B1E2E] text-white'
                : 'bg-white border border-gray-200 text-gray-500'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 결과 합계 */}
      <div className="flex justify-between items-center mb-2 px-1">
        <span className="text-xs text-gray-400">{filtered.length}건</span>
        <span className="text-xs font-semibold text-gray-700">
          합계 {total.toLocaleString()}원
        </span>
      </div>

      {/* 목록 */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {filtered.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-8">해당하는 지출이 없어요.</p>
        ) : (
          <div className="divide-y divide-gray-50 px-4">
            {filtered.map((item) => (
              <ExpenseItem key={item.id} expense={item} userCategories={baseCats} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
