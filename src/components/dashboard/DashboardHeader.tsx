'use client'
import { THEMES } from '@/lib/themes'
import { Theme } from '@/types'

interface Props {
  totalSpent: number
  savingGoal: number
  userName: string
  theme: Theme
}

export default function DashboardHeader({ totalSpent, savingGoal, userName, theme }: Props) {
  const currentTheme = THEMES[theme] || THEMES.Burgundy

  return (
    <div 
      className="text-white px-6 pt-8 pb-12 rounded-b-[2.5rem] shadow-sm transition-all"
      style={{ backgroundColor: currentTheme.primary }}
    >
      <div className="flex justify-between items-center mb-6">
        <div>
          <span className="text-xs opacity-60 block font-medium">WELCOME BACK</span>
          <h2 className="text-lg font-serif tracking-wide">{userName || '경희'}님의 Spenlog</h2>
        </div>
        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm">
          ✨
        </div>
      </div>

      <p className="text-xs opacity-70 mb-1 font-medium">이번 달 지출 총액</p>
      <div className="flex items-baseline gap-1 mb-6">
        <span className="text-xl font-light">₩</span>
        <h1 className="text-4xl font-bold tracking-tight">
          {totalSpent.toLocaleString()}
        </h1>
      </div>

      {savingGoal > 0 && (
        <div className="bg-white/10 rounded-2xl p-3.5 backdrop-blur-sm border border-white/5">
          <div className="flex justify-between text-xs mb-2 opacity-90">
            <span>월 지출 목표</span>
            <span className="font-semibold">₩{savingGoal.toLocaleString()}</span>
          </div>
          <div className="bg-white/20 rounded-full h-1.5 overflow-hidden">
            <div 
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${Math.min((totalSpent / savingGoal) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}