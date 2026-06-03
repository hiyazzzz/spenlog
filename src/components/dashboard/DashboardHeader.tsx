'use client';

interface HeaderProps {
  totalSpent: number;
  savingGoal: number;
  userName: string;
  theme: string;
}

export default function DashboardHeader({ totalSpent, savingGoal, userName }: HeaderProps) {
  const displayName = userName || "소비요정";

  return (
    <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100 mb-4">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">
          안녕하세요, <span className="text-[#802634]">{displayName}</span>님!
        </h1>
        <p className="text-xs text-gray-400 mt-1">오늘도 현명한 소비 습관을 만들어봐요.</p>
      </div>
      
      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-50">
        <div>
          <span className="text-xs text-gray-400 block mb-1">이번 달 총 지출</span>
          <span className="text-base font-bold text-[#802634]">
            {(totalSpent ?? 0).toLocaleString()}원
          </span>
        </div>
        <div>
          <span className="text-xs text-gray-400 block mb-1">저축 목표</span>
          <span className="text-base font-semibold text-emerald-600">
            {(savingGoal ?? 0).toLocaleString()}원
          </span>
        </div>
      </div>
    </div>
  );
}