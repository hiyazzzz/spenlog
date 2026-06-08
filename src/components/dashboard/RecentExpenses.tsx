'use client'
import Link from 'next/link'
import dayjs from 'dayjs'
import { formatCurrency } from '@/lib/format'

interface Expense {
  id: string; name: string; amount: number; category: string
  date: string; payment_method: string | null; type?: string
}

export default function RecentExpenses({ expenses }: { expenses: Expense[] }) {
  const safe = (expenses || []).filter(e => e.type !== 'income').slice(0, 3)

  return (
    <div>
      {safe.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">아직 기록된 지출이 없어요</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {safe.map(e => (
            <div key={e.id} className="flex items-center justify-between py-2.5 first:pt-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{e.name}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {e.date ? dayjs(e.date).format('MM.DD') : ''} · {e.category}
                  {e.payment_method && ' · ' + e.payment_method}
                </p>
              </div>
              <span className="text-sm font-bold text-rose-400 ml-3 flex-shrink-0">
                -{formatCurrency(e.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
