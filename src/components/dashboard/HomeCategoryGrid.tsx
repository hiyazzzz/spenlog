'use client'
import { useRouter } from 'next/navigation'

interface Expense { category: string; amount: number; type?: string }
interface Budget { category: string; amount: number }

interface Props {
  expenses: Expense[]
  budgets: Budget[]
  // 나중에 커스텀 이미지 URL들 추가 예정 (홈 커스텀 Phase 1)
  categoryImages?: Record<string, string | null>
}

const CAT_META: Record<string, { emoji: string; bg: string }> = {
  '생활비': { emoji: '🛒', bg: 'rgba(107,30,46,0.06)' },
  '활동비': { emoji: '☕', bg: 'rgba(74,119,65,0.06)' },
  '고정비': { emoji: '📌', bg: 'rgba(92,75,138,0.06)' },
  '친목비': { emoji: '👫', bg: 'rgba(160,82,45,0.06)' },
}

const FIXED_CATS = ['생활비', '활동비', '고정비', '친목비'] as const

export default function HomeCategoryGrid({ expenses, budgets, categoryImages }: Props) {
  const router = useRouter()

  // net 합계: 지출은 음수, 수입은 양수
  const catMap: Record<string, number> = {}
  ;(expenses || [])
    .filter(e => e.type !== 'transfer')
    .forEach(e => {
      const sign = e.type === 'income' ? 1 : -1
      catMap[e.category] = (catMap[e.category] ?? 0) + sign * Number(e.amount)
    })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#1f2937' }}>카테고리 현황</p>
        <button onClick={() => router.push('/category')}
          style={{ fontSize: 12, color: 'var(--color-primary-mid)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
          전체 보기 →
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {FIXED_CATS.map(cat => {
          const net = catMap[cat] ?? 0
          const spent = Math.abs(net)
          const budget = budgets?.find(b => b.category === cat)?.amount ?? 0
          const pct = budget > 0 ? Math.min(Math.round((spent / budget) * 100), 100) : 0
          const over = budget > 0 && spent > budget
          const meta = CAT_META[cat] ?? { emoji: '💰', bg: '#f9fafb' }
          const imgUrl = categoryImages?.[cat]
          const barColor = over ? '#ef4444' : pct >= 70 ? '#f59e0b' : 'var(--color-primary)'

          return (
            <button key={cat}
              onClick={() => router.push('/history?category=' + cat)}
              style={{
                display: 'flex', flexDirection: 'column',
                background: '#fff', borderRadius: 16,
                border: '1px solid #f3f4f6',
                overflow: 'hidden',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                cursor: 'pointer', fontFamily: 'inherit',
                textAlign: 'left',
              }}>
              {/* 이미지 영역 */}
              <div style={{
                height: 80,
                background: imgUrl
                  ? `url(${imgUrl}) center/cover no-repeat`
                  : meta.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative',
              }}>
                {!imgUrl && (
                  <span style={{ fontSize: 32 }}>{meta.emoji}</span>
                )}
                {over && (
                  <span style={{
                    position: 'absolute', top: 6, right: 6,
                    fontSize: 10, background: '#fef2f2', color: '#ef4444',
                    padding: '2px 6px', borderRadius: 6, fontWeight: 700,
                  }}>초과 ⚠️</span>
                )}
              </div>
              {/* 텍스트 영역 */}
              <div style={{ padding: '10px 12px' }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 3 }}>{cat}</p>
                <p style={{ fontSize: 14, fontWeight: 800, color: net !== 0 ? (net > 0 ? '#059669' : 'var(--color-primary)') : '#d1d5db' }}>
                  {net > 0 ? '+₩' + net.toLocaleString() : net < 0 ? '-₩' + Math.abs(net).toLocaleString() : '₩0'}
                </p>
                {budget > 0 && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ background: '#f3f4f6', borderRadius: 4, height: 3, overflow: 'hidden' }}>
                      <div style={{ width: pct + '%', height: '100%', background: barColor, borderRadius: 4, transition: 'width 0.5s' }} />
                    </div>
                    <p style={{ fontSize: 10, color: '#9ca3af', marginTop: 3 }}>
                      예산 {pct}% 사용
                    </p>
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
