'use client'
import { usePathname } from 'next/navigation'
import { Suspense, memo } from 'react'
import HistoryDataLoader from '@/components/history/HistoryDataLoader'
import AssetsDataLoader from '@/components/assets/AssetsDataLoader'

// 내역/자산 탭을 레이아웃에서 미리 마운트 → 탭 전환 시 서버 왕복 없이 즉각 표시
function TabShellInner({ userId }: { userId: string }) {
  const pathname = usePathname()

  return (
    <>
      <div style={{ display: pathname === '/history' ? 'block' : 'none' }}>
        <Suspense>
          <HistoryDataLoader userId={userId} />
        </Suspense>
      </div>
      <div style={{ display: pathname === '/assets' ? 'block' : 'none' }}>
        <AssetsDataLoader userId={userId} />
      </div>
    </>
  )
}

export default memo(TabShellInner)
