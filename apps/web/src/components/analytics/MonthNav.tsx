'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import dayjs from 'dayjs'

export default function MonthNav({ currentMonth }: { currentMonth: string }) {
  const router = useRouter()

  const go = (offset: number) => {
    const newMonth = dayjs(currentMonth).add(offset, 'month').format('YYYY-MM')
    router.push(`/analytics?month=${newMonth}`)
  }

  const isCurrentMonth = currentMonth === dayjs().format('YYYY-MM')

  return (
    <div className="flex items-center justify-between mb-5">
      <h1 className="text-lg font-semibold text-[#4A1220]">분석</h1>
      <div className="flex items-center gap-3">
        <button
          onClick={() => go(-1)}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 active:scale-95 transition-all text-sm"
        >
          ‹
        </button>
        <span className="text-sm font-semibold text-gray-700 min-w-[72px] text-center">
          {dayjs(currentMonth).format('YYYY년 M월')}
        </span>
        <button
          onClick={() => go(1)}
          disabled={isCurrentMonth}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 active:scale-95 transition-all text-sm disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ›
        </button>
      </div>
    </div>
  )
}
