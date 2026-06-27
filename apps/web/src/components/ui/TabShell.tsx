'use client'
import { usePathname } from 'next/navigation'
import { Suspense, memo } from 'react'
import HistoryDataLoader from '@/components/history/HistoryDataLoader'
import AssetsDataLoader from '@/components/assets/AssetsDataLoader'
import HomeDataLoader from '@/components/dashboard/HomeDataLoader'
import ReportDataLoader from '@/components/report/ReportDataLoader'
import SettingsDataLoader from '@/components/settings/SettingsDataLoader'

function TabShellInner({ userId }: { userId: string }) {
  const pathname = usePathname()
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
