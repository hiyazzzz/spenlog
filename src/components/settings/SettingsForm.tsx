'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { THEMES } from '@/lib/themes'
import { Theme, Budget } from '@/types'
import DarkModeToggle from '@/components/ui/DarkModeToggle'
import BudgetForm from '@/components/budget/BudgetForm'

interface Props {
  profile: any
  userId: string
  email: string
  provider?: string
  budgets: Budget[]
  expenses: { category: string; amount: number }[]
  thisMonth: string
}


export default function SettingsForm({ profile, userId, email, provider, budgets, expenses, thisMonth }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [tab, setTab] = useState<'profile' | 'category' | 'display' | 'login'>('profile')
  const [name, setName] = useState(profile?.name ?? '')
  const [theme, setTheme] = useState<Theme>(profile?.theme ?? 'Burgundy')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [confirmWithdraw, setConfirmWithdraw] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)

  // 테마 즉시 적용
  function applyTheme(t: Theme) {
    setTheme(t)
    const colors = THEMES[t]
    const root = document.documentElement
    root.style.setProperty('--color-primary', colors.primary)
    root.style.setProperty('--color-primary-mid', colors.primaryMid)
    root.style.setProperty('--color-primary-light', colors.primaryLight)
    root.style.setProperty('--color-accent', colors.accent)
    root.style.setProperty('--color-accent', colors.accent)
    root.style.setProperty('--color-bg', colors.bg)
    document.body.style.background = colors.bg
    // 즉시 DB 저장
    supabase.from('users').upsert({ id: userId, theme: t }).then(() => {
      router.refresh()
    })
  }

  async function handleSaveProfile() {
    setSaving(true)
    await supabase.from('users').upsert({
      id: userId,
      name: name.trim() || profile?.name,
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    router.refresh()
  }

  async function handleWithdraw() {
    setWithdrawing(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await Promise.all([
        supabase.from('users').delete().eq('id', user.id),
        supabase.from('expenses').delete().eq('user_id', user.id),
        supabase.from('budgets').delete().eq('user_id', user.id),
        supabase.from('fixed_costs').delete().eq('user_id', user.id),
      ])
    }
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const card = { background: '#fff', borderRadius: '16px', border: '1px solid #f0f0f0', padding: '16px', marginBottom: '12px' }
  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: '12px',
    border: '1.5px solid #EDE3E5', background: '#fafafa',
    fontSize: '14px', color: '#3D2020', outline: 'none',
    boxSizing: 'border-box' as const, fontFamily: 'inherit',
  }
  const label = { fontSize: '11px', color: '#aaa', marginBottom: '6px', display: 'block' as const }

  const TABS = [
    { id: 'profile', label: '프로필' },
    { id: 'category', label: '예산' },
    { id: 'display', label: '화면' },
    { id: 'login', label: '계정' },
  ] as const

  return (
    <div>
      {/* 탭 */}
      <div style={{ display: 'flex', background: '#F0EAEC', borderRadius: '16px', padding: '4px', marginBottom: '20px', gap: '4px' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '8px', borderRadius: '12px', fontSize: '13px', fontWeight: '600',
            border: 'none', cursor: 'pointer',
            background: tab === t.id ? 'var(--color-primary)' : 'transparent',
            color: tab === t.id ? '#fff' : '#B8A8AC', fontFamily: 'inherit',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* 프로필 탭 */}
      {tab === 'profile' && (
        <div>
          <div style={card}>
            <p style={{ ...label, fontWeight: '600', color: '#555', fontSize: '12px', marginBottom: '14px' }}>프로필 정보</p>
            <div>
              <label style={label}>닉네임</label>
              <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="닉네임" maxLength={12} />
            </div>
          </div>
          <button onClick={handleSaveProfile} disabled={saving} style={{
            width: '100%', padding: '14px', borderRadius: '14px',
            background: saved ? '#2E7D52' : 'var(--color-primary)',
            color: '#fff', fontSize: '14px', fontWeight: '600',
            border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            transition: 'background 0.3s', marginBottom: '12px',
          }}>
            {saving ? '저장 중...' : saved ? '✓ 저장됨' : '변경사항 저장'}
          </button>
        </div>
      )}

      {/* 예산 탭 */}
      {tab === 'category' && (
        <div>
          <p className="text-xs text-gray-400 mb-3">{thisMonth.replace('-', '년 ')}월 카테고리별 목표 예산</p>
          <BudgetForm
            userId={userId}
            initialBudgets={budgets}
            expenses={expenses}
            thisMonth={thisMonth}
            income={profile?.income ?? 0}
          />
        </div>
      )}

      {/* 화면 탭 */}
      {tab === 'display' && (
        <div>
          <div style={card}>
            <DarkModeToggle />
          </div>
          <div style={card}>
            <p style={{ ...label, fontWeight: '600', color: '#555', fontSize: '12px', marginBottom: '14px' }}>테마</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {(Object.keys(THEMES) as Theme[]).map((key) => {
                const t = THEMES[key]
                const selected = theme === key
                return (
                  <button key={key} onClick={() => applyTheme(key)} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '12px', borderRadius: '12px',
                    border: selected ? `2px solid ${t.primary}` : '2px solid transparent',
                    background: selected ? t.primaryLight : '#fafafa',
                    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                  }}>
                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: t.primary, flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', fontWeight: '600', color: t.accent }}>{t.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* 계정 탭 */}
      {tab === 'login' && (
        <div>
          <div style={card}>
            <p style={{ ...label, fontWeight: '600', color: '#555', fontSize: '12px', marginBottom: '14px' }}>로그인 정보</p>
            <div style={{ marginBottom: '10px' }}>
              <label style={label}>이메일</label>
              <input style={{ ...inputStyle, color: '#aaa' }} value={email} disabled />
            </div>
            <div style={{ padding: '10px 12px', borderRadius: '12px', background: '#f8f8f8', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {provider === 'google' ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  </svg>
                  <span style={{ fontSize: '13px', color: '#555' }}>Google 계정으로 로그인됨</span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: '13px' }}>✉️</span>
                  <span style={{ fontSize: '13px', color: '#555' }}>이메일로 로그인됨</span>
                </>
              )}
            </div>
          </div>

          <div style={card}>
            <button onClick={handleLogout} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#E05070', fontSize: '14px', fontWeight: '600',
              padding: '4px 0', fontFamily: 'inherit', display: 'block', width: '100%', textAlign: 'left' as const,
            }}>
              로그아웃
            </button>
            <div style={{ borderTop: '1px solid #f0f0f0', marginTop: '12px', paddingTop: '12px' }}>
              {!confirmWithdraw ? (
                <button onClick={() => setConfirmWithdraw(true)} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#ccc', fontSize: '12px', padding: 0, fontFamily: 'inherit',
                }}>계정 탈퇴</button>
              ) : (
                <div>
                  <p style={{ fontSize: '12px', color: '#E05070', marginBottom: '8px' }}>정말 탈퇴하시겠어요? 모든 데이터가 삭제됩니다.</p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setConfirmWithdraw(false)} style={{
                      flex: 1, padding: '8px', borderRadius: '10px', background: '#f5f5f5',
                      border: 'none', cursor: 'pointer', fontSize: '12px', color: '#888', fontFamily: 'inherit',
                    }}>취소</button>
                    <button onClick={handleWithdraw} disabled={withdrawing} style={{
                      flex: 1, padding: '8px', borderRadius: '10px', background: '#E05070',
                      border: 'none', cursor: 'pointer', fontSize: '12px', color: '#fff', fontWeight: '600', fontFamily: 'inherit',
                    }}>{withdrawing ? '처리 중...' : '탈퇴 확인'}</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
