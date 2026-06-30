'use client'
import { usePathname } from 'next/navigation'
import { Suspense, memo, useEffect } from 'react'
import HistoryDataLoader from '@/components/history/HistoryDataLoader'
import AssetsDataLoader from '@/components/assets/AssetsDataLoader'
import HomeDataLoader from '@/components/dashboard/HomeDataLoader'
import ReportDataLoader from '@/components/report/ReportDataLoader'
import SettingsDataLoader from '@/components/settings/SettingsDataLoader'

const TAB_PATHS = ['/', '/history', '/assets', '/report', '/settings']

function TabShellInner({ userId }: { userId: string }) {
  const pathname = usePathname()

  // 탭 전환 시 스크롤 리셋 — display:none/block 방식에서 scroll position 공유 문제 방지
  useEffect(() => {
    if (TAB_PATHS.includes(pathname)) {
      window.scrollTo(0, 0)
    }
  }, [pathname])

  if (!userId) return null

  return (
    <>
      <div style={{ display: pathname === '/' ? 'block' : 'none' }}>
        <Suspense><HomeDataLoader /></Suspense>
      </div>
      <div style={{ display: pathname === '/history' ? 'block' : 'none' }}>
        <Suspense><HistoryDataLoader userId={userId} /></Suspense>
      </div>
      <div style={{ display: pathname === '/assets' ? 'block' : 'none' }}>
        <AssetsDataLoader userId={userId} />
      </div>
      <div style={{ display: pathname === '/report' ? 'block' : 'none' }}>
        <Suspense><ReportDataLoader /></Suspense>
      </div>
      <div style={{ display: pathname === '/settings' ? 'block' : 'none' }}>
        <SettingsDataLoader />
      </div>
    </>
  )
}

export default memo(TabShellInner)
