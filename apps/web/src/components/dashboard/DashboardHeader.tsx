'use client';
import { TEXTS } from '@/config/texts'

interface HeaderProps {
  totalSpent: number;
  savingGoal: number;
  income: number;
  userName: string;
  theme: string;
}

export default function DashboardHeader({ totalSpent, savingGoal, income, userName }: HeaderProps) {
  const displayName = userName || TEXTS.header.defaultName;
  const savedAmount = Math.max(0, income - totalSpent);
  const savingPct = savingGoal > 0 ? Math.min(Math.round((savedAmount / savingGoal) * 100), 100) : 0;
  const isGoalMet = savingGoal > 0 && savedAmount >= savingGoal;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
      <div className="p-5">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">
          {TEXTS.header.greetingPrefix}<span style={{ color: 'var(--color-primary)' }}>{displayName}</span>{TEXTS.header.greetingSuffix}
        </h1>
        <p className="text-xs text-gray-400 mt-1">{TEXTS.header.subtitle}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-50 mb-4">
        <div>
          <span className="text-xs text-gray-400 block mb-1">{TEXTS.header.totalSpent}</span>
          <span className="text-base font-bold" style={{ color: 'var(--color-primary)' }}>
            {(totalSpent ?? 0).toLocaleString()}원
          </span>
        </div>
        <div>
          <span className="text-xs text-gray-400 block mb-1">{TEXTS.header.savingGoal}</span>
          <span className="text-base font-semibold text-emerald-600">
            {(savingGoal ?? 0).toLocaleString()}원
          </span>
        </div>
      </div>

      {savingGoal > 0 && (
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-gray-400">{TEXTS.header.savingProgress}</span>
            <span className={`font-semibold ${isGoalMet ? 'text-emerald-600' : 'text-gray-600'}`}>
              {isGoalMet ? TEXTS.header.goalMet : TEXTS.header.savingPct(savingPct, savedAmount)}
            </span>
          </div>
          <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${savingPct}%`,
                background: isGoalMet ? '#10B981' : 'var(--color-primary)',
              }}
            />
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
