import BottomNav from '@/components/ui/BottomNav'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    /* 모바일 앱 스크린처럼 고정되도록 최대 가로폭(max-w-md)과 세로 중앙 정렬 베이스를 잡아줍니다. */
    <div className="min-h-screen max-w-md mx-auto bg-[#FAF7F4] pb-24 relative shadow-sm">
      {/* 홈, 분석, 예산 등의 실제 탭 내용이 여기에 그려집니다. */}
      {children}
      
      {/* 가이드 문서 Phase 1-7에 있던 하단 네비게이션 바가 하단에 고정됩니다. */}
      <BottomNav />
    </div>
  )
}