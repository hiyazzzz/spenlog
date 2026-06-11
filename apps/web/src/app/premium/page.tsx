'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const BENEFITS = [
  { icon: '📊', title: '월간 리포트', desc: '총 지출 + 카테고리 breakdown + 3개월 패턴 분석' },
  { icon: '🤖', title: 'AI 코치', desc: '패턴 진단 → 동기부여 → 구체적 행동 제안 3단계' },
  { icon: '💡', title: 'AI 예산 추천', desc: '3개월 지출 기반 카테고리별 최적 예산 자동 추천' },
  { icon: '🎨', title: '추가 테마', desc: 'Oatmeal / Warm Gray / Midnight / Indigo 4종' },
  { icon: '🖼️', title: '홈 커스텀', desc: '커버 이미지 + 카테고리 이미지 PNG/GIF 자유 교체' },
  { icon: '📄', title: '명세서 파싱', desc: '카드 명세서 PDF 업로드 → AI 자동 파싱 + 일괄 등록' },
]

export default function PremiumPage() {
  const [plan, setPlan] = useState<'monthly' | 'yearly'>('yearly')
  const router = useRouter()

  const price = plan === 'monthly' ? '5,900원/월' : '44,900원/년'
  const subtitle = plan === 'yearly' ? '월 3,742원 — 37% 할인' : ''

  return (
    <div style={{ minHeight: '100vh', background: '#FAF7F4', maxWidth: 420, margin: '0 auto' }}>
      {/* 헤더 */}
      <div style={{
        background: 'linear-gradient(135deg, #6B1E2E 0%, #A0525F 100%)',
        padding: '48px 24px 32px',
        color: '#fff',
        textAlign: 'center' as const,
        position: 'relative' as const,
      }}>
        <button onClick={() => router.back()} style={{
          position: 'absolute' as const, top: 16, left: 16,
          background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%',
          width: 36, height: 36, color: '#fff', cursor: 'pointer', fontSize: 18,
        }}>←</button>
        <p style={{ fontSize: 13, opacity: 0.8, marginBottom: 8 }}>💎 Spenlog Premium</p>
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8 }}>
          소비 패턴이 보이면<br />더 나은 선택이 보여요
        </h1>
        <p style={{ fontSize: 13, opacity: 0.75 }}>소비 패턴을 분석하고 더 스마트하게 절약해요</p>
      </div>

      <div style={{ padding: '24px' }}>
        {/* 플랜 선택 */}
        <div style={{ display: 'flex', background: '#F0EAEC', borderRadius: 16, padding: 4, marginBottom: 20, gap: 4 }}>
          {(['monthly', 'yearly'] as const).map(p => (
            <button key={p} onClick={() => setPlan(p)} style={{
              flex: 1, padding: '10px', borderRadius: 12, border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
              background: plan === p ? '#6B1E2E' : 'transparent',
              color: plan === p ? '#fff' : '#B8A8AC',
              position: 'relative' as const,
            }}>
              {p === 'monthly' ? '월간' : '연간'}
              {p === 'yearly' && (
                <span style={{
                  position: 'absolute' as const, top: -8, right: 4,
                  background: '#F59E0B', color: '#fff', fontSize: 9, fontWeight: 700,
                  padding: '2px 6px', borderRadius: 8,
                }}>37% 할인</span>
              )}
            </button>
          ))}
        </div>

        {/* 가격 */}
        <div style={{ textAlign: 'center' as const, marginBottom: 24 }}>
          <p style={{ fontSize: 32, fontWeight: 800, color: '#6B1E2E' }}>{price}</p>
          {subtitle && <p style={{ fontSize: 13, color: '#9A7A80' }}>{subtitle}</p>}
        </div>

        {/* 혜택 리스트 */}
        <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #f0f0f0', marginBottom: 20, overflow: 'hidden' }}>
          {BENEFITS.map((b, i) => (
            <div key={b.title} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 16px',
              borderBottom: i < BENEFITS.length - 1 ? '1px solid #f9fafb' : 'none',
            }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>{b.icon}</span>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#1f2937', marginBottom: 2 }}>{b.title}</p>
                <p style={{ fontSize: 11, color: '#9ca3af' }}>{b.desc}</p>
              </div>
              <span style={{ marginLeft: 'auto', color: '#10B981', fontSize: 16 }}>✓</span>
            </div>
          ))}
        </div>

        {/* CTA 버튼 */}
        <button style={{
          width: '100%', padding: '16px', borderRadius: 16,
          background: 'linear-gradient(135deg, #6B1E2E, #A0525F)',
          color: '#fff', fontSize: 15, fontWeight: 700,
          border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          boxShadow: '0 4px 16px rgba(107,30,46,0.3)',
          marginBottom: 12,
        }}>
          프리미엄 시작하기 — {price}
        </button>

        {/* 보조 텍스트 */}
        <div style={{ textAlign: 'center' as const }}>
          <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>언제든지 해지 가능</p>
          <button style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 11, color: '#B8A8AC', textDecoration: 'underline', fontFamily: 'inherit',
          }}>
            구매 항목 복원
          </button>
        </div>
      </div>
    </div>
  )
}
