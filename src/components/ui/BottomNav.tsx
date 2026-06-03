'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/',         icon: '🏠', label: '홈' },
  { href: '/analytics', icon: '📊', label: '분석' },
  { href: '/budget',   icon: '📅', label: '예산' },
  { href: '/fixed',    icon: '🔄', label: '고정비' },
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
          className={`flex-1 flex flex-col items-center py-2 gap-1 text-xs font-medium transition-colors
            ${pathname === item.href ? 'text-[#6B1E2E]' : 'text-gray-400'}`}
        >
          <span className="text-lg">{item.icon}</span>
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
