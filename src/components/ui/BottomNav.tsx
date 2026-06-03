'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/',         icon: '🏠', label: '홈' },
  { href: '/analytics', icon: '📊', label: '분석' },
  { href: '/report',   icon: '📋', label: '리포트' },
  { href: '/budget',   icon: '📅', label: '예산' },
  { href: '/settings', icon: '⚙️', label: '설정' },
]

export default function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex pb-safe">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`flex-1 flex flex-col items-center py-2 gap-0.5 text-[10px] font-medium transition-colors
            ${pathname === item.href ? 'text-[var(--color-primary)]' : 'text-gray-400'}`}
        >
          <span className="text-lg">{item.icon}</span>
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
