// src/app/(dashboard)/layout.tsx
import React from "react";
import BottomNav from "@/components/ui/BottomNav";
import "../globals.css"; // ◀ 대시보드 레이아웃에도 이 스타일 패스를 직접 꽂아줍니다!

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // 대시보드 전체에 감성 베이지 배경색과 최소 높이를 지정합니다
    <div className="min-h-screen bg-[#FAF7F4] flex flex-col justify-between">
      
      {/* 본문 영역: 최대 너비를 모바일 세로 규격(max-w-md)으로 제한하고 중앙 정렬합니다 */}
      <main className="flex-1 w-full max-w-md mx-auto p-4 pb-24">
        {children}
      </main>

      {/* 하단 탭바 메뉴 고정 */}
      <BottomNav />
    </div>
  );
}