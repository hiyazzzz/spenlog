'use client';

import ExpenseItem from '@/components/expense/ExpenseItem'

interface RecentExpensesProps {
  expenses: any[];
}

export default function RecentExpenses({ expenses }: RecentExpensesProps) {
  const safeExpenses = expenses || [];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden" style={{ minHeight: 160, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm font-bold text-gray-900">최근 지출 내역</h2>
      </div>

      {safeExpenses.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-6">아직 기록된 지출이 없어요!</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {safeExpenses.map((item) => (
            <ExpenseItem key={item.id} expense={item} />
          ))}
        </div>
      )}
    </div>
  );
}
