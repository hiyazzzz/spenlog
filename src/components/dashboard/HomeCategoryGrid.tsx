'use client'
import { useRouter } from 'next/navigation'

interface Expense { category: string; amount: number; type?: string }
interface Budget { category: string; amount: number }
interface Category { name: string; color?: string | null }

interface Props {
  expenses: Expense[]
  budgets: Budget[]
  categoryImages?: Record<string, string | null>
  userCategories?: Category[]  // 유저 커스텀 카테고리 순서
}

const DEFAULT_CATS = ['생활비', '활동비', '고정비', '친목비']
const CAT_META: Record<string, { bg: string }> = {
  '생활비': { bg: 'rgba(107,30,46,0.08)' },
  '활동비': { bg: 'rgba(74,119,65,0.08)' },
  '고정비': { bg: 'rgba(92,75,138,0.08)' },
  '친목비': { bg: 'rgba(160,82,45,0.08)' },
}

export default function HomeCategoryGrid({ expenses, budgets, categoryImages, userCategories }: Props) {
  const router = useRouter()

  // 표시할 카테고리 상위 4개 (커스텀 순서 or 기본)
  const displayCats = userCategories && userCategories.length > 0
    ? userCategories.slice(0, 4).map(c => c.name)
    : DEFAULT_CATS

  // net 합계: 지출 -, 수입 +
  const catMap: Record<string, number> = {}
  ;(expenses || []).filter(e => e.type !== 'transfer').forEach(e => {
    const sign = e.type === 'income' ? 1 : -1
    catMap[e.category] = (catMap[e.category] ?? 0) + sign * Number(e.amount)
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#1f2937' }}>카테고리 현황</p>
        <button onClick={() => router.push('/category')}
          style={{ fontSize: 12, color: 'var(--color-primary-mid)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
          카테고리 관리 →
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {displayCats.map((cat, idx) => {
          const net = catMap[cat] ?? 0
          const spent = Math.abs(net)
          const budget = budgets?.find(b => b.category === cat)?.amount ?? 0
          const pct = budget > 0 ? Math.min(Math.round((spent / budget) * 100), 100) : 0
          const over = budget > 0 && spent > budget
          const meta = CAT_META[cat] ?? { bg: '#f9fafb' }
          const imgUrl = categoryImages?.[cat]
          const barColor = over ? '#ef4444' : pct >= 70 ? '#f59e0b' : 'var(--color-primary)'
          // 카테고리별 색상 (커스텀)
          const userCat = userCategories?.find(c => c.name === cat)
          const cardBg = imgUrl
            ? `url(${imgUrl}) center/cover no-repeat`
            : userCat?.color ?? meta.bg

          return (
            <button key={cat}
              onClick={() => router.push('/category')}
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
                background: imgUrl ? `url(${imgUrl}) center/cover no-repeat` : (userCat?.color ?? meta.bg),
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
                {/* 카테고리명 오버레이 */}
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
                  {net > 0 ? '+' : net < 0 ? '-' : ''}{net !== 0 ? spent.toLocaleString() + '원' : '0원'}
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
