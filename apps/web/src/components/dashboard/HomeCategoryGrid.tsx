'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { THEME_CARD_PALETTES } from '@/lib/themes'
import { formatCurrency } from '@/lib/format'
import { useGifAwareSrc } from '@/lib/useGifAwareSrc'

interface Expense { category: string; amount: number; type?: string }
interface Budget { category: string; amount: number }
interface Category { name: string; color?: string | null }

interface Props {
  expenses: Expense[]
  budgets: Budget[]
  categoryImages?: (string | null | undefined)[]  // 슬롯(위치) 기반 배열 — 카테고리명이 아닌 인덱스로 접근
  userCategories?: Category[]
  theme?: string | null
  gifAutoplay?: boolean
}

const DEFAULT_CATS = ['생활비', '활동비', '고정비', '친목비']
const DEFAULT_PALETTE = THEME_CARD_PALETTES['Burgundy']

export default function HomeCategoryGrid({ expenses, budgets, categoryImages, userCategories, theme, gifAutoplay = true }: Props) {
  const router = useRouter()
  const [palette, setPalette] = useState<string[]>(() => THEME_CARD_PALETTES[(theme as string) ?? 'Burgundy'] ?? DEFAULT_PALETTE)

  // 슬롯(0~3) 고정 — gif_autoplay가 꺼져있으면 GIF 첫 프레임으로 대체
  const resolvedImages = [
    useGifAwareSrc(categoryImages?.[0], gifAutoplay),
    useGifAwareSrc(categoryImages?.[1], gifAutoplay),
    useGifAwareSrc(categoryImages?.[2], gifAutoplay),
    useGifAwareSrc(categoryImages?.[3], gifAutoplay),
  ]

  useEffect(() => {
    const t = theme ?? (typeof window !== 'undefined' ? localStorage.getItem('spenlog_theme') : null) ?? 'Burgundy'
    setPalette(THEME_CARD_PALETTES[t] ?? DEFAULT_PALETTE)
  }, [theme])

  const displayCats = userCategories && userCategories.length > 0
    ? userCategories.slice(0, 4).map(c => c.name)
    : DEFAULT_CATS

  const catMap: Record<string, number> = {}
  ;(expenses || []).filter(e => e.type !== 'transfer').forEach(e => {
    const sign = e.type === 'income' ? 1 : -1
    catMap[e.category] = (catMap[e.category] ?? 0) + sign * Number(e.amount)
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#1f2937' }}>카테고리 현황</p>
        <Link href="/category"
          style={{ fontSize: 12, color: 'var(--color-primary-mid)', textDecoration: 'none' }}>
          카테고리 관리 →
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {displayCats.map((cat, idx) => {
          const net = catMap[cat] ?? 0
          const spent = Math.abs(net)
          const budget = budgets?.find(b => b.category === cat)?.amount ?? 0
          const pct = budget > 0 ? Math.min(Math.round((spent / budget) * 100), 100) : 0
          const over = budget > 0 && spent > budget
          const imgUrl = resolvedImages[idx] ?? null  // 슬롯 인덱스로 접근
          const barColor = over ? '#ef4444' : pct >= 70 ? '#f59e0b' : 'var(--color-primary)'
          const cardBgColor = palette[idx] ?? palette[0]

          return (
            <button key={cat}
              onClick={() => router.push('/budget')}
              style={{
                display: 'flex', flexDirection: 'column',
                background: '#fff', borderRadius: 16,
                border: '1px solid #f3f4f6',
                overflow: 'hidden',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
              }}>
              <div style={{
                height: 80,
                background: imgUrl ? `url(${imgUrl}) center/cover no-repeat` : cardBgColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative',
              }}>
                {over && (
                  <span style={{
                    position: 'absolute', top: 6, right: 6,
                    fontSize: 10, background: '#fef2f2', color: '#ef4444',
                    padding: '2px 6px', borderRadius: 6, fontWeight: 700,
                  }}>초과 ⚠️</span>
                )}
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  background: 'linear-gradient(transparent, rgba(0,0,0,0.35))',
                  padding: '8px 10px 6px',
                }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>{cat}</p>
                </div>
              </div>
              <div style={{ padding: '8px 10px' }}>
                <p style={{ fontSize: 14, fontWeight: 800, color: net > 0 ? '#059669' : net < 0 ? 'var(--color-primary)' : '#d1d5db' }}>
                  {net > 0 ? '+' : net < 0 ? '-' : ''}{net !== 0 ? formatCurrency(spent) : formatCurrency(0)}
                </p>
                {budget > 0 && (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ background: '#f3f4f6', borderRadius: 4, height: 3, overflow: 'hidden' }}>
                      <div style={{ width: pct + '%', height: '100%', background: barColor, borderRadius: 4 }} />
                    </div>
                    <p style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>예산 {pct}% 사용</p>
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
