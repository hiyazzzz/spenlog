'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Account, Card, FixedCost } from '@/types'

interface Props {
  profile: any
  userId: string
  accounts: Account[]
  cards: Card[]
  fixedCosts: FixedCost[]
  thisMonthSpent: number
  thisMonth: string
}

function formatNum(v: string) {
  const n = v.replace(/[^0-9]/g, '')
  return n ? parseInt(n).toLocaleString() : ''
}
function parseNum(v: string) {
  return parseInt(v.replace(/,/g, '')) || 0
}

export default function AssetsClient({ profile, userId, accounts, cards, fixedCosts, thisMonthSpent, thisMonth }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [tab, setTab] = useState<'overview' | 'cashflow' | 'goal'>('overview')
  const [editingIncome, setEditingIncome] = useState(false)
  const [income, setIncome] = useState(profile?.income ? parseInt(profile.income).toLocaleString() : '')
  const [savingGoal, setSavingGoal] = useState(profile?.saving_goal ? parseInt(profile.saving_goal).toLocaleString() : '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // 계산값
  const monthlyIncome = profile?.income ?? 0
  const savingGoalAmt = profile?.saving_goal ?? 0
  const fixedSpend = fixedCosts.filter(f => (f.kind ?? '고정지출') === '고정지출').reduce((s, f) => s + f.amount, 0)
  const fixedSave = fixedCosts.filter(f => f.kind === '고정저축').reduce((s, f) => s + f.amount, 0)
  const totalFixedOut = fixedSpend + fixedSave
  const freeBudget = monthlyIncome - totalFixedOut  // 자유자금
  const realSavings = Math.max(0, monthlyIncome - thisMonthSpent - fixedSave)
  const savingPct = savingGoalAmt > 0 ? Math.min(Math.round((realSavings / savingGoalAmt) * 100), 100) : 0
  const totalAssets = accounts.reduce((s, a) => s + (a.balance ?? 0), 0)

  async function handleSave() {
    setSaving(true)
    await supabase.from('users').upsert({
      id: userId,
      income: parseNum(income),
      saving_goal: parseNum(savingGoal),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    router.refresh()
  }

  const card = { background: '#fff', borderRadius: '18px', border: '1px solid #f0f0f0', padding: '16px', marginBottom: '12px' }
  const labelStyle = { fontSize: '11px', color: '#aaa', marginBottom: '4px', display: 'block' as const }
  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: '12px',
    border: '1.5px solid #EDE3E5', background: '#fafafa',
    fontSize: '14px', color: '#3D2020', outline: 'none',
    boxSizing: 'border-box' as const, fontFamily: 'inherit',
  }

  const TABS = [
    { id: 'overview', label: '현금흐름' },
    { id: 'cashflow', label: '수입·지출' },
    { id: 'goal', label: '저축목표' },
  ] as const

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--color-bg)' }}>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold" style={{ color: 'var(--color-accent)' }}>자산</h1>
        <button
          onClick={() => setEditingIncome(!editingIncome)}
          className="text-xs px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-gray-500"
        >
          {editingIncome ? '닫기' : '✏️ 수정'}
        </button>
      </div>

      {/* 수입·저축목표 수정 패널 */}
      {editingIncome && (
        <div style={card}>
          <p style={{ fontSize: '12px', fontWeight: '600', color: '#555', marginBottom: '12px' }}>재정 정보 수정</p>
          <div style={{ marginBottom: '10px' }}>
            <label style={labelStyle}>월 수입 (원)</label>
            <input style={inputStyle} type="text" inputMode="numeric"
              value={income} onChange={e => setIncome(formatNum(e.target.value))} placeholder="0" />
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>월 저축 목표 (원)</label>
            <input style={inputStyle} type="text" inputMode="numeric"
              value={savingGoal} onChange={e => setSavingGoal(formatNum(e.target.value))} placeholder="0" />
          </div>
          <button onClick={handleSave} disabled={saving} style={{
            width: '100%', padding: '12px', borderRadius: '12px',
            background: saved ? '#2E7D52' : 'var(--color-primary)',
            color: '#fff', fontSize: '13px', fontWeight: '600', border: 'none',
            cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
          }}>
            {saving ? '저장 중...' : saved ? '✓ 저장됨' : '저장'}
          </button>
        </div>
      )}

      {/* 핵심 지표 카드 */}
      <div style={{ ...card, background: 'var(--color-primary)', color: '#fff' }}>
        <p style={{ fontSize: '11px', opacity: 0.75, marginBottom: '4px' }}>이번 달 자유자금</p>
        <p style={{ fontSize: '28px', fontWeight: '800', marginBottom: '2px' }}>
          {freeBudget > 0 ? freeBudget.toLocaleString() : '0'}원
        </p>
        <p style={{ fontSize: '11px', opacity: 0.65 }}>
          수입 {monthlyIncome.toLocaleString()}원 − 고정비 {totalFixedOut.toLocaleString()}원
        </p>
        {totalAssets > 0 && (
          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.2)' }}>
            <p style={{ fontSize: '11px', opacity: 0.75 }}>총 보유 자산</p>
            <p style={{ fontSize: '18px', fontWeight: '700' }}>{totalAssets.toLocaleString()}원</p>
          </div>
        )}
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', background: '#F0EAEC', borderRadius: '16px', padding: '4px', marginBottom: '16px', gap: '4px' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '8px', borderRadius: '12px', fontSize: '12px', fontWeight: '600',
            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            background: tab === t.id ? 'var(--color-primary)' : 'transparent',
            color: tab === t.id ? '#fff' : '#B8A8AC',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* 현금흐름 탭 */}
      {tab === 'overview' && (
        <div>
          {/* 수입 */}
          <div style={card}>
            <p style={{ fontSize: '11px', color: '#aaa', marginBottom: '8px', fontWeight: '600' }}>💰 월 수입</p>
            {monthlyIncome > 0 ? (
              <p style={{ fontSize: '20px', fontWeight: '700', color: 'var(--color-accent)' }}>
                {monthlyIncome.toLocaleString()}원
              </p>
            ) : (
              <button onClick={() => setEditingIncome(true)} style={{
                fontSize: '13px', color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0,
              }}>+ 월 수입 입력하기</button>
            )}
          </div>

          {/* 고정비 요약 */}
          <div style={card}>
            <p style={{ fontSize: '11px', color: '#aaa', marginBottom: '10px', fontWeight: '600' }}>📌 고정비 현황</p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <div style={{ flex: 1, background: '#FFF1F2', borderRadius: '12px', padding: '10px', textAlign: 'center' as const }}>
                <p style={{ fontSize: '10px', color: '#E05070', marginBottom: '2px' }}>고정지출</p>
                <p style={{ fontSize: '15px', fontWeight: '700', color: '#C03050' }}>{fixedSpend.toLocaleString()}원</p>
              </div>
              <div style={{ flex: 1, background: '#F0FDF4', borderRadius: '12px', padding: '10px', textAlign: 'center' as const }}>
                <p style={{ fontSize: '10px', color: '#10B981', marginBottom: '2px' }}>고정저축</p>
                <p style={{ fontSize: '15px', fontWeight: '700', color: '#059669' }}>{fixedSave.toLocaleString()}원</p>
              </div>
            </div>
            {fixedCosts.length === 0 ? (
              <a href="/fixed" style={{ fontSize: '12px', color: 'var(--color-primary)', textDecoration: 'none' }}>
                + 고정비 등록하기 →
              </a>
            ) : (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' as const }}>
                {fixedCosts.slice(0, 4).map(f => (
                  <span key={f.id} style={{ fontSize: '11px', background: '#f8f8f8', padding: '4px 8px', borderRadius: '8px', color: '#666' }}>
                    {f.name} {f.amount.toLocaleString()}원
                  </span>
                ))}
                {fixedCosts.length > 4 && (
                  <a href="/fixed" style={{ fontSize: '11px', color: 'var(--color-primary)', padding: '4px 8px' }}>
                    +{fixedCosts.length - 4}개 더 →
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 수입·지출 탭 */}
      {tab === 'cashflow' && (
        <div>
          <div style={card}>
            <p style={{ fontSize: '11px', color: '#aaa', marginBottom: '10px', fontWeight: '600' }}>이번 달 흐름</p>
            <div className="space-y-3">
              {[
                { label: '월 수입', value: monthlyIncome, color: '#10B981' },
                { label: '이달 지출', value: thisMonthSpent, color: '#EF4444', negative: true },
                { label: '고정지출', value: fixedSpend, color: '#F59E0B', sub: true },
                { label: '고정저축', value: fixedSave, color: '#10B981', sub: true },
                { label: '실제 저축', value: realSavings, color: 'var(--color-primary)', bold: true },
              ].map(({ label, value, color, negative, sub, bold }) => (
                <div key={label} className="flex justify-between items-center"
                  style={{ paddingLeft: sub ? '12px' : '0', borderTop: bold ? '1px solid #f0f0f0' : 'none', paddingTop: bold ? '8px' : '0' }}>
                  <span style={{ fontSize: '13px', color: sub ? '#aaa' : '#555', fontWeight: bold ? '600' : '400' }}>
                    {sub && '↳ '}{label}
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: bold ? '700' : '600', color }}>
                    {negative && value > 0 ? '-' : ''}{value.toLocaleString()}원
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 카드/계좌 */}
          {(accounts.length > 0 || cards.length > 0) && (
            <div style={card}>
              <p style={{ fontSize: '11px', color: '#aaa', marginBottom: '10px', fontWeight: '600' }}>🏦 계좌 · 카드</p>
              {accounts.map(acc => (
                <div key={acc.id} className="flex justify-between items-center py-2 border-b border-gray-50">
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: '500', color: '#333' }}>{acc.name}</p>
                    <p style={{ fontSize: '10px', color: '#aaa' }}>{acc.bank} · {acc.type}</p>
                  </div>
                  <p style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-accent)' }}>
                    {(acc.balance ?? 0).toLocaleString()}원
                  </p>
                </div>
              ))}
              {cards.map(card => (
                <div key={card.id} className="flex justify-between items-center py-2 border-b border-gray-50">
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: '500', color: '#333' }}>{card.name}</p>
                    <p style={{ fontSize: '10px', color: '#aaa' }}>
                      {card.bank}{card.due_day ? ` · 결제일 ${card.due_day}일` : ''}
                    </p>
                  </div>
                  <span style={{ fontSize: '11px', background: '#f8f8f8', padding: '3px 8px', borderRadius: '8px', color: '#888' }}>카드</span>
                </div>
              ))}
              <a href="/fixed" style={{ fontSize: '12px', color: 'var(--color-primary)', textDecoration: 'none', display: 'block', marginTop: '8px' }}>
                계좌·카드 관리 →
              </a>
            </div>
          )}
          {accounts.length === 0 && cards.length === 0 && (
            <div style={{ ...card, textAlign: 'center' as const }}>
              <p style={{ fontSize: '13px', color: '#aaa', marginBottom: '8px' }}>등록된 계좌·카드가 없어요</p>
              <a href="/setup/assets" style={{ fontSize: '13px', color: 'var(--color-primary)', fontWeight: '600' }}>
                + AI와 함께 자산 등록하기
              </a>
            </div>
          )}
        </div>
      )}

      {/* 저축목표 탭 */}
      {tab === 'goal' && (
        <div>
          <div style={card}>
            <p style={{ fontSize: '11px', color: '#aaa', marginBottom: '10px', fontWeight: '600' }}>🎯 이번 달 저축 현황</p>
            {savingGoalAmt > 0 ? (
              <>
                <div className="flex justify-between items-end mb-2">
                  <div>
                    <p style={{ fontSize: '22px', fontWeight: '800', color: realSavings >= savingGoalAmt ? '#10B981' : 'var(--color-accent)' }}>
                      {realSavings.toLocaleString()}원
                    </p>
                    <p style={{ fontSize: '11px', color: '#aaa' }}>목표 {savingGoalAmt.toLocaleString()}원</p>
                  </div>
                  <p style={{ fontSize: '24px', fontWeight: '800', color: realSavings >= savingGoalAmt ? '#10B981' : 'var(--color-primary)' }}>
                    {savingPct}%
                  </p>
                </div>
                <div style={{ background: '#f0f0f0', borderRadius: '99px', height: '10px', overflow: 'hidden', marginBottom: '8px' }}>
                  <div style={{
                    height: '100%', borderRadius: '99px', transition: 'width 0.5s',
                    width: `${savingPct}%`,
                    background: realSavings >= savingGoalAmt ? '#10B981' : 'var(--color-primary)',
                  }} />
                </div>
                {realSavings >= savingGoalAmt ? (
                  <p style={{ fontSize: '12px', color: '#10B981', fontWeight: '600' }}>🎉 이번 달 저축 목표 달성!</p>
                ) : (
                  <p style={{ fontSize: '12px', color: '#aaa' }}>
                    목표까지 {(savingGoalAmt - realSavings).toLocaleString()}원 더 필요해요
                  </p>
                )}
                {fixedSave > 0 && (
                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #f8f8f8' }}>
                    <p style={{ fontSize: '11px', color: '#10B981' }}>
                      고정저축 {fixedSave.toLocaleString()}원 포함
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center' as const, padding: '12px 0' }}>
                <p style={{ fontSize: '13px', color: '#aaa', marginBottom: '10px' }}>저축 목표를 설정해 보세요</p>
                <button onClick={() => setEditingIncome(true)} style={{
                  fontSize: '13px', color: '#fff', background: 'var(--color-primary)',
                  border: 'none', padding: '8px 20px', borderRadius: '12px', cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  저축 목표 입력하기
                </button>
              </div>
            )}
          </div>

          {/* 월 단위 저축 예측 */}
          {savingGoalAmt > 0 && monthlyIncome > 0 && (
            <div style={card}>
              <p style={{ fontSize: '11px', color: '#aaa', marginBottom: '8px', fontWeight: '600' }}>📈 저축 시뮬레이션</p>
              {[3, 6, 12].map(months => (
                <div key={months} className="flex justify-between py-1.5 border-b border-gray-50">
                  <span style={{ fontSize: '12px', color: '#666' }}>{months}개월 후</span>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--color-accent)' }}>
                    {(savingGoalAmt * months).toLocaleString()}원
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
