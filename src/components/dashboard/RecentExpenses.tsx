'use client'
import { Expense } from '@/types'
import dayjs from 'dayjs'

interface Props {
  expenses: Expense[]
}

export default function RecentExpenses({ expenses }: Props) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-800 mb-4">최근 지출 내역</h3>
      {expenses.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-6">아직 기록된 지출이 없어요.✨</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {expenses.map((e) => (
            <div key={e.id} className="flex justify-between items-center py-3 first:pt-0 last:pb-0">
              <div>
                <p className="text-sm font-medium text-gray-800">{e.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {e.category} · {dayjs(e.date).format('MM월 DD일')}
                </p>
              </div>
              <p className="text-sm font-semibold text-gray-900">
                -₩{e.amount.toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}