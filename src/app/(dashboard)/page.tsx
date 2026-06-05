import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import dayjs from 'dayjs'
import Link from 'next/link'
import AiInputBox from '@/components/expense/AiInputBox'
import HomeCategoryGrid from '@/components/dashboard/HomeCategoryGrid'
import RecentExpenses from '@/components/dashboard/RecentExpenses'
import HomeEditModal from '@/components/dashboard/HomeEditModal'
import { formatCurrency } from '@/lib/format'

export default async function DashboardHomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const thisMonth = dayjs().format('YYYY-MM')
  const [{ data: profile }, { data: expenses }, { data: budgets }] = await Promise.all([
    supabase.from('users').select('*').eq('id', user.id).single(),
    supabase.from('expenses').select('*').eq('user_id', user.id)
      .gte('date', thisMonth + '-01').order('date', { ascending: false }),
    supabase.from('budgets').select('*').eq('user_id', user.id).eq('month', thisMonth),
  ])

  const allExpenses = expenses ?? []
  const totalSpent = allExpenses.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0)
  const recentExpenses = allExpenses.filter(e => e.type === 'expense').slice(0, 3)
  const savingGoal = profile?.saving_goal ?? 0
  const displayName = profile?.name || '소비요정'
  const isPremium = profile?.premium_status === 'active'
  const coverUrl = profile?.home_cover_url ?? null
  const categoryUrls = {
    '생활비': profile?.category_img_url_1 ?? null,
    '활동비': profile?.category_img_url_2 ?? null,
    '고정비': profile?.category_img_url_3 ?? null,
    '친목비': profile?.category_img_url_4 ?? null,
  }

  const card = {
    background: '#fff',
    borderRadius: 16,
    border: '1px solid #f3f4f6',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    padding: 20,
  } as const

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* 커버 이미지 배너 */}
      <div style={{
        height: 200, borderRadius: 16, overflow: 'hidden', position: 'relative',
        background: coverUrl ? undefined : 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-mid) 100%)',
      }}>
        {coverUrl && (
          <img src={coverUrl} alt="cover"
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
        )}
        {/* 오버레이 */}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.28)' }} />
        {/* 텍스트 */}
        <div style={{ position: 'absolute', bottom: 20, left: 20 }}>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginBottom: 4 }}>안녕하세요 👋</p>
          <p style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>{displayName}님</p>
        </div>
        {/* 지출/저축 요약 */}
        <div style={{ position: 'absolute', bottom: 20, right: 20, textAlign: 'right' }}>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11 }}>이번 달 지출</p>
          <p style={{ color: '#fff', fontSize: 16, fontWeight: 800 }}>{formatCurrency(totalSpent)}</p>
          {savingGoal > 0 && (
            <>
              <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 4 }}>저축 목표</p>
              <p style={{ color: '#a7f3d0', fontSize: 14, fontWeight: 700 }}>{formatCurrency(savingGoal)}</p>
            </>
          )}
        </div>
      </div>

      {/* 편집 버튼 (클라이언트 컴포넌트) */}
      <HomeEditModal
        userId={user.id}
        isPremium={isPremium}
        currentCoverUrl={coverUrl}
        currentCategoryUrls={categoryUrls}
      />

      {/* 카드 B — 한 줄 기록 */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#1f2937' }}>한 줄 기록</p>
          <Link href="/add" style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'var(--color-primary)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 700, textDecoration: 'none',
          }}>+</Link>
        </div>
        <AiInputBox userId={user.id} />
      </div>

      {/* 카드 C — 카테고리 2x2 그리드 */}
      <div style={card}>
        <HomeCategoryGrid expenses={allExpenses} budgets={budgets ?? []} categoryImages={categoryUrls} />
      </div>

      {/* 카드 D — 최근 지출 내역 */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#1f2937' }}>최근 지출 내역</p>
          <Link href="/history" style={{ fontSize: 12, color: 'var(--color-primary-mid)', textDecoration: 'none' }}>
            전체 보기 →
          </Link>
        </div>
        <RecentExpenses expenses={recentExpenses} />
      </div>

    </div>
  )
}
