'use client';

import ExpenseItem from '@/components/expense/ExpenseItem'

interface RecentExpensesProps {
  expenses: any[];
}

export default function RecentExpenses({ expenses }: RecentExpensesProps) {
  const safeExpenses = expenses || [];

  return (
    <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
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
