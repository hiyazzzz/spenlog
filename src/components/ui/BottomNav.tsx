'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/',        icon: '🏠', label: '홈' },
  { href: '/history', icon: '📋', label: '내역' },
  { href: '/assets',  icon: '💳', label: '자산' },
  { href: '/report',  icon: '📊', label: '리포트' },
  { href: '/settings',icon: '⚙️', label: '설정' },
]

export default function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex pb-safe">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex-1 flex flex-col items-center py-2 gap-0.5 text-[10px] font-medium transition-all relative"
            style={{ color: active ? 'var(--color-primary)' : '#AAAAAA' }}
          >
            {/* 상단 활성 표시선 */}
            {active && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full"
                style={{ background: 'var(--color-primary)' }} />
            )}
            <span style={{ fontSize: active ? '20px' : '18px', fontWeight: active ? 700 : 400, transition: 'all 0.15s' }}>
              {item.icon}
            </span>
            <span style={{ fontWeight: active ? 600 : 400 }}>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
