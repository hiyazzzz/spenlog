'use client'
import { usePathname } from 'next/navigation'
import { Suspense, memo, useLayoutEffect } from 'react'
import HistoryDataLoader from '@/components/history/HistoryDataLoader'
import AssetsDataLoader from '@/components/assets/AssetsDataLoader'
import HomeDataLoader from '@/components/dashboard/HomeDataLoader'
import ReportDataLoader from '@/components/report/ReportDataLoader'
import SettingsDataLoader from '@/components/settings/SettingsDataLoader'

const TAB_PATHS = ['/', '/history', '/assets', '/report', '/settings']

function TabShellInner({ userId }: { userId: string }) {
  const pathname = usePathname()

  // paint 전에 scroll 리셋 — PWA standalone은 pushState 시 scroll을 자동 리셋하지 않아서 직접 처리
  useLayoutEffect(() => {
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
