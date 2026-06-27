'use client'
import React from 'react'
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

interface Props {
  userId: string
  profile: any
  expenses: any[]
  budgets: any[]
  userCategories: any[]
}

export default function HomeClient({ userId, profile, expenses, budgets, userCategories }: Props) {
  const allExpenses = expenses ?? []
  const totalSpent = allExpenses.filter((e: any) => e.type === 'expense').reduce((s: number, e: any) => s + e.amount, 0)
  const recentExpenses = allExpenses.filter((e: any) => e.type === 'expense').slice(0, 3)
  const savingGoal = profile?.saving_goal ?? 0
  const actualSaving = allExpenses.filter((e: any) => e.type === 'savings').reduce((s: number, e: any) => s + e.amount, 0)
  const displayName = profile?.name || '소비요정'
  const isPremium = isPremiumUnlocked(profile)
  const coverUrl = profile?.home_cover_url ?? null
  const imgFields = [profile?.category_img_url_1, profile?.category_img_url_2, profile?.category_img_url_3, profile?.category_img_url_4]
  const topCats = (userCategories ?? []).slice(0, 4)
  const categoryImageSlots: (string | null)[] = imgFields.slice(0, 4).map((u: any) => u ?? null)
  const categoryUrls: Record<string, string | null> = {}
  topCats.forEach((cat: any, i: number) => { categoryUrls[cat.name] = imgFields[i] ?? null })
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
        {coverUrl && <GifAwareCoverImage src={coverUrl} autoplay={gifAutoplay} />}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.28)' }} />
        <div style={{ position: 'absolute', top: 18, left: 18 }}>
          <GreetingText fallback="안녕하세요 👋" />
          <p style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>{displayName}님</p>
        </div>
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
          userId={userId}
          isPremium={isPremium}
          currentCoverUrl={coverUrl}
          currentCategoryUrls={categoryUrls}
          displayName={displayName}
          totalSpent={totalSpent}
          savingGoal={savingGoal}
          actualSaving={actualSaving}
          userCategories={(userCategories ?? []).map((c: any) => c.name)}
          theme={profile?.theme ?? null}
          recentExpenses={recentExpenses.map((e: any) => ({
            id: e.id,
            name: e.name ?? e.memo ?? '',
            amount: e.amount,
            category: e.category ?? '',
            date: e.date ?? '',
            payment_method: e.payment_method ?? null,
          }))}
          expenses={(allExpenses ?? []).map((e: any) => ({ category: e.category ?? '', amount: e.amount, type: e.type ?? 'expense' }))}
          budgets={(budgets ?? []).map((b: any) => ({ category: b.category, amount: b.amount }))}
          currentGreeting={profile?.greeting_custom_text ?? null}
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
        <AiInputBox userId={userId} userCategories={(userCategories ?? []).map((c: any) => c.name)} compact />
      </div>

      {/* 카테고리 2x2 그리드 */}
      <div style={card}>
        <HomeCategoryGrid
          expenses={allExpenses}
          budgets={budgets ?? []}
          categoryImages={categoryImageSlots}
          userCategories={userCategories ?? []}
          theme={profile?.theme ?? null}
          gifAutoplay={gifAutoplay}
        />
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
