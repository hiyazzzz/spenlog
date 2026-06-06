'use client'
import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { THEMES } from '@/lib/themes'
import type { Theme } from '@/types'
import { subscribePush, unsubscribePush, isSubscribed } from '@/lib/push'

function ToggleSwitch({ on, onToggle, disabled }: { on: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button onClick={onToggle} disabled={disabled}
      style={{
        width: 44, height: 24, borderRadius: 12, border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        background: on ? 'var(--color-primary)' : '#d1d5db',
        transition: 'background 0.2s', position: 'relative', flexShrink: 0,
      }}>
      <div style={{
        position: 'absolute', top: 3,
        left: on ? 22 : 3,
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  )
}

const BASIC_THEMES: Theme[] = ['Burgundy', 'Sage']
const PREMIUM_THEMES = [
  { key: 'Lavender', color: THEMES.Lavender.primary, label: '라벤더' },
  { key: 'Terracotta', color: THEMES.Terracotta.primary, label: '테라코타' },
  { key: 'Oatmeal', color: '#C8B8A2', label: 'Oatmeal' },
  { key: 'WarmGray', color: '#9E9E9E', label: 'Warm Gray' },
  { key: 'Midnight', color: '#1A237E', label: 'Midnight' },
  { key: 'Indigo', color: '#3949AB', label: 'Indigo' },
]

interface Props {
  profile: any
  userId: string
  email: string
  provider: string
  isGuest?: boolean
}

export default function SettingsForm({ profile, userId, email, provider, isGuest = false }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [theme, setTheme] = useState<Theme>(profile?.theme ?? 'Burgundy')
  const [name, setName] = useState(profile?.name ?? '')
  const [editingName, setEditingName] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [notifications, setNotifications] = useState({
    all: profile?.push_enabled ?? true,
    dueDateReminder: profile?.push_due_date_reminder ?? true,
    dueDateUnprocessed: profile?.push_due_date_unprocessed ?? true,
    report: profile?.push_report ?? true,
    reminder: profile?.push_expense_reminder ?? true,
  })
  const isPremium = profile?.premium_status === 'active'
  const [loggingOut, setLoggingOut] = useState(false)
  const [guestLogoutConfirm, setGuestLogoutConfirm] = useState(false)
  const [googleLinking, setGoogleLinking] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<boolean | 1 | 2>(false)
  const [pushSubscribed, setPushSubscribed] = useState(false)

  useEffect(() => {
    isSubscribed().then(setPushSubscribed)
  }, [])
  const [deleteConfirmName, setDeleteConfirmName] = useState('')

  function applyTheme(t: Theme) {
    setTheme(t)
    const colors = THEMES[t]
    const root = document.documentElement
    root.style.setProperty('--color-primary', colors.primary)
    root.style.setProperty('--color-primary-mid', colors.primaryMid)
    root.style.setProperty('--color-primary-light', colors.primaryLight)
    root.style.setProperty('--color-accent', colors.accent)
    root.style.setProperty('--color-bg', colors.bg)
    document.body.style.background = colors.bg
    supabase.from('users').upsert({ id: userId, theme: t }).then(() => router.refresh())
  }

  async function saveName() {
    if (!name.trim()) return
    setSavingName(true)
    await supabase.from('users').update({ name: name.trim() }).eq('id', userId)
    setSavingName(false)
    setEditingName(false)
    router.refresh()
  }

  async function handleGuestLogoutAndDelete() {
    setLoggingOut(true)
    try {
      // 게스트 데이터 전체 삭제
      await Promise.all([
        supabase.from('expenses').delete().eq('user_id', userId),
        supabase.from('accounts').delete().eq('user_id', userId),
        supabase.from('cards').delete().eq('user_id', userId),
        supabase.from('fixed_costs').delete().eq('user_id', userId),
        supabase.from('budgets').delete().eq('user_id', userId),
        supabase.from('categories').delete().eq('user_id', userId),
        supabase.from('users').delete().eq('id', userId),
      ])
      await supabase.auth.signOut({ scope: 'global' })
      window.location.href = '/login'
    } catch {
      setLoggingOut(false)
    }
  }

  async function handleGoogleLink() {
    setGoogleLinking(true)
    const { error } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      alert('연동 중 오류가 발생했어요: ' + error.message)
      setGoogleLinking(false)
    }
  }

  async function handleLogout() {
    if (isGuest) {
      setGuestLogoutConfirm(true)
      return
    }
    setLoggingOut(true)
    await supabase.auth.signOut({ scope: 'global' })
    if (typeof window !== 'undefined') {
      sessionStorage.clear()
      localStorage.removeItem('spenlog_offline_queue')
    }
    window.location.href = '/login'
  }

  async function handleDeleteAccount() {
    await supabase.from('users').delete().eq('id', userId)
    await supabase.auth.signOut({ scope: 'global' })
    if (typeof window !== 'undefined') {
      sessionStorage.clear()
      localStorage.clear()
    }
    window.location.href = '/login'
  }

  const card: React.CSSProperties = { background: '#fff', borderRadius: 18, border: '1px solid #f0f0f0', marginBottom: 10, overflow: 'hidden' }
  const sectionHeader: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: '#9ca3af', padding: '14px 16px 6px', letterSpacing: '0.05em' }
  const rowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 16px', borderBottom: '1px solid #f9fafb' }

  return (
    <div>
      {/* 게스트 로그아웃 경고 모달 */}
      {guestLogoutConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ width: '100%', background: '#fff', borderRadius: '20px 20px 0 0', padding: '28px 24px 48px' }}>
            <p style={{ fontSize: 18, fontWeight: 800, color: '#1f2937', marginBottom: 8 }}>⚠️ 로그아웃 전에 확인해요</p>
            <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6, marginBottom: 24 }}>
              게스트 계정에서 로그아웃하면<br />
              <strong style={{ color: '#ef4444' }}>모든 기록·설정 데이터가 영구 삭제</strong>됩니다.<br />
              Google 계정으로 연동하면 데이터를 보존할 수 있어요.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={handleGoogleLink} style={{
                width: '100%', padding: '14px', borderRadius: 14,
                background: '#fff', border: '1.5px solid #e5e7eb',
                fontSize: 14, fontWeight: 700, color: '#1f2937',
                cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Google로 연동하고 데이터 보존
              </button>
              <button onClick={() => { setGuestLogoutConfirm(false); handleGuestLogoutAndDelete() }} disabled={loggingOut} style={{
                width: '100%', padding: '13px', borderRadius: 14,
                background: '#fef2f2', border: 'none',
                fontSize: 14, color: '#ef4444', cursor: 'pointer', fontFamily: 'inherit',
              }}>
                {loggingOut ? '처리 중...' : '데이터 삭제 후 로그아웃'}
              </button>
              <button onClick={() => setGuestLogoutConfirm(false)} style={{
                width: '100%', padding: '13px', borderRadius: 14,
                background: '#f3f4f6', border: 'none',
                fontSize: 14, color: '#6b7280', cursor: 'pointer', fontFamily: 'inherit',
              }}>취소</button>
            </div>
          </div>
        </div>
      )}
      {/* 프로필 상단 */}
      <div style={{ ...card, padding: '24px 16px', textAlign: 'center' as const, marginBottom: 16 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🌿</div>
        {editingName ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 8 }}>
            <input value={name} onChange={e => setName(e.target.value)}
              style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-accent)', border: '1.5px solid var(--color-primary-light)', borderRadius: 10, padding: '6px 12px', outline: 'none', fontFamily: 'inherit', textAlign: 'center' as const }}
              maxLength={12} autoFocus />
            <button onClick={saveName} disabled={savingName}
              style={{ fontSize: 12, padding: '6px 12px', borderRadius: 10, border: 'none', background: 'var(--color-primary)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
              {savingName ? '...' : '저장'}
            </button>
            <button onClick={() => setEditingName(false)}
              style={{ fontSize: 12, padding: '6px 10px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: '#6b7280', cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
          </div>
        ) : (
          <div style={{ marginBottom: 4 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-accent)' }}>{profile?.name ?? '이름 없음'}</span>
            <button onClick={() => setEditingName(true)}
              style={{ marginLeft: 8, fontSize: 11, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>✏️</button>
          </div>
        )}
        <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 16 }}>{email}</p>
        <button onClick={() => router.push('/premium')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '10px 24px', borderRadius: 12,
            background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
            color: '#fff', fontSize: 14, fontWeight: 700,
            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          }}>
          💎 Premium
        </button>
      </div>

      {/* 게스트 안내 배너 */}
      {isGuest && (
        <div style={{
          background: 'linear-gradient(135deg, #fff7ed, #fef3c7)',
          border: '1.5px solid #fde68a', borderRadius: 16, padding: '16px',
          marginBottom: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#92400e' }}>게스트 계정 사용 중</p>
          </div>
          <p style={{ fontSize: 13, color: '#b45309', lineHeight: 1.5, marginBottom: 12 }}>
            로그아웃하거나 기기를 변경하면 모든 데이터가 사라져요.<br />
            Google 계정으로 연동하면 영구 보관됩니다.
          </p>
          <button onClick={handleGoogleLink} disabled={googleLinking} style={{
            width: '100%', padding: '12px', borderRadius: 12,
            background: '#fff', border: '1.5px solid #fde68a',
            fontSize: 14, fontWeight: 700, color: '#1f2937',
            cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {googleLinking ? '연동 중...' : 'Google 계정으로 연동하기'}
          </button>
        </div>
      )}

      {/* 계정 섹션 */}
      <div style={card}>
        <p style={sectionHeader}>👤 계정</p>
        <div style={rowStyle}>
          <span style={{ fontSize: 14, color: '#374151' }}>로그인 방식</span>
          <span style={{ fontSize: 13, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
            {isGuest ? '👤 게스트' : provider === 'google' ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="14" height="14" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google
              </span>
            ) : '이메일'}
          </span>
        </div>
        <div style={{ ...rowStyle, borderBottom: 'none' }}>
          <span style={{ fontSize: 14, color: '#374151' }}>계정</span>
          <span style={{ fontSize: 13, color: '#6b7280' }}>
            {isGuest ? '게스트 계정' : (email || '-')}
          </span>
        </div>

        {/* 소셜 연동 */}
        {!isGuest && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid #f9fafb' }}>
            <p style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600, marginBottom: 10 }}>소셜 연동</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span style={{ fontSize: 14, color: '#374151' }}>Google</span>
              </div>
              {provider === 'google' ? (
                <span style={{ fontSize: 12, fontWeight: 600, color: '#059669', background: '#f0fdf4', padding: '4px 10px', borderRadius: 20 }}>연동됨 ✓</span>
              ) : (
                <button onClick={handleGoogleLink} disabled={googleLinking} style={{
                  fontSize: 12, fontWeight: 600, color: 'var(--color-primary)',
                  background: 'var(--color-primary-light)', border: 'none',
                  padding: '4px 12px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  {googleLinking ? '연동 중...' : '연동하기'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 테마 섹션 */}
      <div style={card}>
        <p style={sectionHeader}>🎨 테마</p>
        <div style={{ padding: '0 16px 16px' }}>
          <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 10, fontWeight: 600 }}>기본</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
            {BASIC_THEMES.map(key => {
              const t = THEMES[key]
              const selected = theme === key
              return (
                <button key={key} onClick={() => applyTheme(key)} style={{
                  padding: '12px', borderRadius: 14,
                  border: selected ? '2.5px solid ' + t.primary : '2px solid transparent',
                  background: selected ? t.primaryLight : '#f9fafb',
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 10,
                  transition: 'all 0.15s',
                }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: t.primary, flexShrink: 0 }} />
                  <div style={{ textAlign: 'left' as const }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: t.primary }}>{t.name}</p>
                    {selected && <p style={{ fontSize: 10, color: t.primaryMid }}>적용 중 ✓</p>}
                  </div>
                </button>
              )
            })}
          </div>
          <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 10, fontWeight: 600 }}>프리미엄 ✨</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {PREMIUM_THEMES.map(t => {
              const isAvailable = t.key in THEMES  // Lavender, Terracotta만 THEMES에 있음
              const isSelected = theme === t.key
              const handleClick = () => {
                if (!isPremium) { router.push('/premium'); return }
                if (isAvailable) applyTheme(t.key as Theme)
              }
              return (
                <button key={t.key} onClick={handleClick} style={{
                  padding: '12px', borderRadius: 14,
                  border: isSelected ? '2.5px solid ' + t.color : '2px solid transparent',
                  background: isSelected ? (THEMES[t.key as Theme]?.primaryLight ?? '#f9fafb') : '#f9fafb',
                  cursor: isPremium && isAvailable ? 'pointer' : 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 10,
                  opacity: (!isPremium || !isAvailable) ? 0.6 : 1,
                  transition: 'all 0.15s',
                }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: t.color, flexShrink: 0, position: 'relative' as const }}>
                    {!isPremium && <span style={{ position: 'absolute' as const, top: -4, right: -4, fontSize: 12 }}>🔒</span>}
                    {isPremium && !isAvailable && <span style={{ position: 'absolute' as const, top: -4, right: -4, fontSize: 10, background: '#e5e7eb', borderRadius: 4, padding: '1px 3px', color: '#6b7280' }}>준비중</span>}
                  </div>
                  <div style={{ textAlign: 'left' as const }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: isSelected ? t.color : '#6b7280' }}>{t.label}</p>
                    {isSelected && isPremium && <p style={{ fontSize: 10, color: t.color }}>적용 중 ✓</p>}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* 알림 섹션 */}
      <div style={card}>
        <p style={sectionHeader}>🔔 알림</p>

        {/* 전체 알림 토글 */}
        <div style={{ ...rowStyle, borderBottom: '1px solid #f9fafb' }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>전체 알림</p>
            {pushSubscribed && <p style={{ fontSize: 11, color: '#10b981', marginTop: 2 }}>✓ 알림 구독 중</p>}
          </div>
          <ToggleSwitch
            on={notifications.all}
            onToggle={async () => {
              const next = !notifications.all
              setNotifications(n => ({ ...n, all: next }))
              supabase.from('users').update({ push_enabled: next }).eq('id', userId)
              if (next && !pushSubscribed) {
                const ok = await subscribePush(userId)
                setPushSubscribed(ok)
              } else if (!next && pushSubscribed) {
                await unsubscribePush(userId)
                setPushSubscribed(false)
              }
            }}
          />
        </div>

        {/* 카드·고정비 납부 리마인드 — 대주제 */}
        <div style={{ padding: '10px 16px 4px', opacity: notifications.all ? 1 : 0.4 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#6b7280' }}>💳 카드 · 고정비 납부 리마인드</p>
        </div>

        {/* 출금일 리마인드 */}
        <div style={{ ...rowStyle, paddingLeft: 24, borderBottom: '1px solid #f9fafb', opacity: notifications.all ? 1 : 0.4 }}>
          <div>
            <p style={{ fontSize: 13, color: '#374151' }}>출금일 리마인드 알림</p>
            <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>출금일 D-7일부터 매일 발송</p>
          </div>
          <ToggleSwitch
            on={notifications.dueDateReminder && notifications.all}
            disabled={!notifications.all}
            onToggle={() => {
              if (!notifications.all) return
              const next = !notifications.dueDateReminder
              setNotifications(n => ({ ...n, dueDateReminder: next }))
              supabase.from('users').update({ push_due_date_reminder: next }).eq('id', userId)
            }}
          />
        </div>

        {/* 당일 미처리 알림 */}
        <div style={{ ...rowStyle, paddingLeft: 24, borderBottom: '1px solid #f9fafb', opacity: notifications.all ? 1 : 0.4 }}>
          <div>
            <p style={{ fontSize: 13, color: '#374151' }}>당일 미처리 알림</p>
            <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>출금일 당일 미기록 시 발송</p>
          </div>
          <ToggleSwitch
            on={notifications.dueDateUnprocessed && notifications.all}
            disabled={!notifications.all}
            onToggle={() => {
              if (!notifications.all) return
              const next = !notifications.dueDateUnprocessed
              setNotifications(n => ({ ...n, dueDateUnprocessed: next }))
              supabase.from('users').update({ push_due_date_unprocessed: next }).eq('id', userId)
            }}
          />
        </div>

        {/* 월간 리포트 */}
        <div style={{ ...rowStyle, borderBottom: '1px solid #f9fafb', opacity: notifications.all ? 1 : 0.4 }}>
          <div>
            <p style={{ fontSize: 14, color: '#374151' }}>📊 월간 리포트 공개</p>
            <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>매월 1일 리포트 알림</p>
          </div>
          <ToggleSwitch
            on={notifications.report && notifications.all}
            disabled={!notifications.all}
            onToggle={() => {
              if (!notifications.all) return
              const next = !notifications.report
              setNotifications(n => ({ ...n, report: next }))
              supabase.from('users').update({ push_report: next }).eq('id', userId)
            }}
          />
        </div>

        {/* 지출 입력 리마인드 */}
        <div style={{ ...rowStyle, borderBottom: 'none', opacity: notifications.all ? 1 : 0.4 }}>
          <div>
            <p style={{ fontSize: 14, color: '#374151' }}>✏️ 지출 입력 리마인드</p>
            <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>점심(12:00) · 저녁(19:00)</p>
          </div>
          <ToggleSwitch
            on={notifications.reminder && notifications.all}
            disabled={!notifications.all}
            onToggle={() => {
              if (!notifications.all) return
              const next = !notifications.reminder
              setNotifications(n => ({ ...n, reminder: next }))
              supabase.from('users').update({ push_expense_reminder: next }).eq('id', userId)
            }}
          />
        </div>
      </div>

      {/* 디스플레이 섹션 (프리미엄 전용) */}
      <div style={{ ...card, opacity: isPremium ? 1 : 0.7, position: 'relative' as const }}>
        <div style={{ ...sectionHeader as React.CSSProperties, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>🖼️ 디스플레이</span>
          {!isPremium && (
            <button onClick={() => router.push('/premium')}
              style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700, background: '#fef3c7', border: 'none', borderRadius: 8, padding: '2px 8px', cursor: 'pointer', fontFamily: 'inherit' }}>
              🔒 프리미엄
            </button>
          )}
        </div>
        <div style={{ ...rowStyle, borderBottom: 'none', pointerEvents: isPremium ? 'auto' : 'none' }}>
          <div>
            <p style={{ fontSize: 14, color: '#374151' }}>홈 화면 움직이는 이미지</p>
            <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>GIF 재생 켜기/끄기</p>
          </div>
          <ToggleSwitch
            on={isPremium && (profile?.gif_autoplay ?? true)}
            disabled={!isPremium}
            onToggle={() => {
              if (!isPremium) return
              supabase.from('users').update({ gif_autoplay: !(profile?.gif_autoplay ?? true) }).eq('id', userId)
            }}
          />
        </div>
        {!isPremium && (
          <div style={{ padding: '0 16px 12px' }} onClick={() => router.push('/premium')}>
            <p style={{ fontSize: 12, color: '#9ca3af', cursor: 'pointer' }}>
              프리미엄에서 홈 화면을 나만의 이미지/GIF로 꾸밀 수 있어요
            </p>
          </div>
        )}
      </div>

      {/* 앱 정보 */}
      <div style={card}>
        <p style={sectionHeader}>ℹ️ 앱 정보</p>
        <div style={rowStyle}>
          <span style={{ fontSize: 14, color: '#374151' }}>앱 가이드 다시 보기</span>
          <span style={{ fontSize: 14, color: '#9ca3af' }}>›</span>
        </div>
        <div style={{ ...rowStyle, borderBottom: 'none' }}>
          <span style={{ fontSize: 14, color: '#374151' }}>버전</span>
          <span style={{ fontSize: 13, color: '#9ca3af' }}>1.0.0</span>
        </div>
      </div>

      {/* 계정 관리 */}
      <div style={card}>
        <p style={sectionHeader}>⚠️ 계정 관리</p>
        <button onClick={handleLogout} disabled={loggingOut}
          style={{ ...rowStyle, width: '100%', textAlign: 'left' as const, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', borderBottom: '1px solid #f9fafb' }}>
          <span style={{ fontSize: 14, color: '#374151' }}>{loggingOut ? '로그아웃 중...' : '로그아웃'}</span>
          <span style={{ fontSize: 14, color: '#9ca3af' }}>›</span>
        </button>
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)}
            style={{ ...rowStyle, width: '100%', textAlign: 'left' as const, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', borderBottom: 'none' }}>
            <span style={{ fontSize: 14, color: '#ef4444' }}>회원 탈퇴</span>
            <span style={{ fontSize: 14, color: '#9ca3af' }}>›</span>
          </button>
        ) : confirmDelete === 1 ? (
          <div style={{ padding: '12px 16px' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 6 }}>탈퇴하시겠어요?</p>
            <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12, lineHeight: 1.6 }}>
              모든 지출 내역, 자산 설정, 구독 이력이 삭제돼요
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setConfirmDelete(2)}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: '#ef4444', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                계속
              </button>
              <button onClick={() => setConfirmDelete(false)}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                취소
              </button>
            </div>
          </div>
        ) : (
          <div style={{ padding: '12px 16px' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 4 }}>닉네임을 입력해 본인 확인</p>
            <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 10 }}>
              "{profile?.name ?? '닉네임'}"을 그대로 입력해주세요
            </p>
            <input
              type="text"
              placeholder={profile?.name ?? '닉네임'}
              value={deleteConfirmName}
              onChange={e => setDeleteConfirmName(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 13, outline: 'none', fontFamily: 'inherit', marginBottom: 10, boxSizing: 'border-box' as const }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmName !== profile?.name}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: deleteConfirmName === profile?.name ? '#ef4444' : '#f3f4f6', color: deleteConfirmName === profile?.name ? '#fff' : '#9ca3af', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                탈퇴하기
              </button>
              <button onClick={() => { setConfirmDelete(false); setDeleteConfirmName('') }}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                취소
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
