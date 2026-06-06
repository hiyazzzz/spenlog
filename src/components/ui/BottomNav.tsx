'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/',         label: '홈' },
  { href: '/history',  label: '내역' },
  { href: '/assets',   label: '자산' },
  { href: '/report',   label: '리포트' },
  { href: '/settings', label: '설정' },
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
            className="flex-1 flex flex-col items-center py-3 gap-0.5 text-[11px] font-medium transition-all relative"
            style={{ color: active ? 'var(--color-primary)' : '#AAAAAA' }}
          >
            {active && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full"
                style={{ background: 'var(--color-primary)' }} />
            )}
            <span style={{ fontWeight: active ? 700 : 400, fontSize: active ? 12 : 11 }}>
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
