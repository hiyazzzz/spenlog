import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import dayjs from 'dayjs'
import Link from 'next/link'
import AiInputBox from '@/components/expense/AiInputBox'
import HomeCategoryGrid from '@/components/dashboard/HomeCategoryGrid'
import RecentExpenses from '@/components/dashboard/RecentExpenses'
import HomeEditModal from '@/components/dashboard/HomeEditModal'
import GifAwareCoverImage from '@/components/dashboard/GifAwareCoverImage'
import GreetingText from '@/components/dashboard/GreetingText'
import { formatCurrency } from '@/lib/format'
import { isPremiumUnlocked } from '@/lib/premium'
import { THEME_COVER_GRADIENTS } from '@/lib/themes'

export default async function DashboardHomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const thisMonth = dayjs().format('YYYY-MM')
  const [{ data: profile }, { data: expenses }, { data: budgets }, { data: userCategories }, { data: fixedCosts }] = await Promise.all([
    supabase.from('users').select('*').eq('id', user.id).single(),
    supabase.from('expenses').select('*').eq('user_id', user.id)
      .gte('date', thisMonth + '-01').order('date', { ascending: false }),
    supabase.from('budgets').select('*').eq('user_id', user.id).eq('month', thisMonth),
    supabase.from('categories').select('name, color').eq('user_id', user.id).eq('is_hidden', false).order('sort_order'),
    supabase.from('fixed_costs').select('amount, kind').eq('user_id', user.id),
  ])

  const allExpenses = expenses ?? []
  const totalSpent = allExpenses.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0)
  const recentExpenses = allExpenses.filter(e => e.type === 'expense').slice(0, 3)
  const savingGoal = profile?.saving_goal ?? 0
  const income = profile?.income ?? 0
  const fixedSavingsTotal = (fixedCosts ?? []).filter((f: any) => f.kind === '고정저축').reduce((s: number, f: any) => s + f.amount, 0)
  const actualSaving = fixedSavingsTotal + Math.max(0, income - totalSpent - fixedSavingsTotal)
  const displayName = profile?.name || '소비요정'
  const isPremium = isPremiumUnlocked(profile)
  const coverUrl = profile?.home_cover_url ?? null
  const imgFields = [profile?.category_img_url_1, profile?.category_img_url_2, profile?.category_img_url_3, profile?.category_img_url_4]
  const topCats = (userCategories ?? []).slice(0, 4)
  // HomeCategoryGrid 용 — 슬롯(위치) 기반 배열. 카테고리가 바뀌어도 슬롯 이미지는 유지됨
  const categoryImageSlots: (string | null)[] = imgFields.slice(0, 4).map(u => u ?? null)
  // HomeEditModal 용 — 편집 UI에서 이름 키 필요
  const categoryUrls: Record<string, string | null> = {}
  topCats.forEach((cat, i) => { categoryUrls[cat.name] = imgFields[i] ?? null })
  const gifAutoplay = profile?.gif_autoplay ?? true
  const coverGradient = THEME_COVER_GRADIENTS[(profile?.theme as string) ?? 'Burgundy'] ?? THEME_COVER_GRADIENTS.Burgundy

  const card = {
    background: '#fff',
    borderRadius: 16,
    border: '1px solid #f3f4f6',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    padding: 20,
    minHeight: 160,
  } as const

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* 커버 이미지 배너 */}
      <div style={{
        height: 200, borderRadius: 16, overflow: 'hidden', position: 'relative',
        background: coverUrl ? undefined : coverGradient,
      }}>
        {coverUrl && (
          <GifAwareCoverImage src={coverUrl} autoplay={gifAutoplay} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.28)' }} />
        {/* 인사말 — 상단 좌측 */}
        <div style={{ position: 'absolute', top: 18, left: 18 }}>
          <GreetingText fallback="안녕하세요 👋" />
          <p style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>{displayName}님</p>
        </div>
        {/* 스탯 — 하단 풀워스 바 */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.38)', padding: '10px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 10, margin: 0 }}>이번 달 지출</p>
            <p style={{ color: '#fff', fontSize: 15, fontWeight: 800, margin: 0 }}>{formatCurrency(totalSpent)}</p>
          </div>
          {savingGoal > 0 && (
            <>
              <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.2)' }} />
              <div style={{ textAlign: 'right' as const }}>
                <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 10, margin: 0 }}>저축 달성</p>
                <p style={{ color: '#a7f3d0', fontSize: 13, fontWeight: 700, margin: 0 }}>{formatCurrency(actualSaving)} / {formatCurrency(savingGoal)}</p>
              </div>
            </>
          )}
        </div>
        <HomeEditModal
          userId={user.id}
          isPremium={isPremium}
          currentCoverUrl={coverUrl}
          currentCategoryUrls={categoryUrls}
          displayName={displayName}
          totalSpent={totalSpent}
          savingGoal={savingGoal}
          actualSaving={actualSaving}
          userCategories={(userCategories ?? []).map(c => c.name)}
          theme={profile?.theme ?? null}
          recentExpenses={recentExpenses.map(e => ({
            id: e.id,
            name: (e as any).name ?? e.memo ?? '',
            amount: e.amount,
            category: e.category ?? '',
            date: e.date ?? '',
            payment_method: (e as any).payment_method ?? null,
          }))}
          expenses={(allExpenses ?? []).map(e => ({ category: e.category ?? '', amount: e.amount, type: e.type ?? 'expense' }))}
          budgets={(budgets ?? []).map(b => ({ category: b.category, amount: b.amount }))}
          currentGreeting={(profile as any)?.greeting_custom_text ?? null}
        />
      </div>

      {/* 한 줄 기록 */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#1f2937' }}>한 줄 기록</p>
          <Link href="/add" style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'var(--color-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            textDecoration: 'none',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </Link>
        </div>
        <AiInputBox userId={user.id} userCategories={(userCategories ?? []).map(c => c.name)} compact />
      </div>

      {/* 카테고리 2x2 그리드 */}
      <div style={card}>
        <HomeCategoryGrid expenses={allExpenses} budgets={budgets ?? []} categoryImages={categoryImageSlots} userCategories={userCategories ?? []} theme={profile?.theme ?? null} gifAutoplay={gifAutoplay} />
      </div>

      {/* 최근 지출 내역 */}
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
