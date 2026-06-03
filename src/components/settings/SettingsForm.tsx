'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { THEMES } from '@/lib/themes'
import { Theme } from '@/types'

interface Props {
  profile: any
  userId: string
  email: string
}

export default function SettingsForm({ profile, userId, email }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [name, setName] = useState(profile?.name ?? '')
  const [income, setIncome] = useState(String(profile?.income ?? ''))
  const [savingGoal, setSavingGoal] = useState(String(profile?.saving_goal ?? ''))
  const [theme, setTheme] = useState<Theme>(profile?.theme ?? 'Burgundy')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    await supabase.from('users').upsert({
      id: userId,
      name: name.trim() || profile?.name,
      income: Number(income) || 0,
      saving_goal: Number(savingGoal) || 0,
      theme,
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    router.refresh()
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const card = {
    background: '#fff',
    borderRadius: '16px',
    border: '1px solid #f0f0f0',
    padding: '16px',
    marginBottom: '12px',
  }
  const label = { fontSize: '11px', color: '#aaa', marginBottom: '6px', display: 'block' as const }
  const input = {
    width: '100%', padding: '10px 12px', borderRadius: '12px',
    border: '1.5px solid #EDE3E5', background: '#fafafa',
    fontSize: '14px', color: '#3D2020', outline: 'none',
    boxSizing: 'border-box' as const, fontFamily: 'inherit',
  }

  return (
    <div>
      {/* 프로필 */}
      <div style={card}>
        <p style={{ ...label, marginBottom: '12px', fontWeight: '600', color: '#555', fontSize: '12px' }}>프로필</p>
        <div style={{ marginBottom: '10px' }}>
          <label style={label}>닉네임</label>
          <input style={input} value={name} onChange={e => setName(e.target.value)} placeholder="닉네임" />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label style={label}>이메일</label>
          <input style={{ ...input, color: '#aaa' }} value={email} disabled />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label style={label}>월 수입 (원)</label>
          <input style={input} type="number" value={income} onChange={e => setIncome(e.target.value)} placeholder="0" />
        </div>
        <div>
          <label style={label}>저축 목표 (원)</label>
          <input style={input} type="number" value={savingGoal} onChange={e => setSavingGoal(e.target.value)} placeholder="0" />
        </div>
      </div>

      {/* 테마 */}
      <div style={card}>
        <p style={{ ...label, fontWeight: '600', color: '#555', fontSize: '12px', marginBottom: '12px' }}>테마 색상</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {(Object.keys(THEMES) as Theme[]).map((key) => {
            const t = THEMES[key]
            const selected = theme === key
            return (
              <button key={key} onClick={() => setTheme(key)} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '12px', borderRadius: '12px',
                border: selected ? `2px solid ${t.primary}` : '2px solid transparent',
                background: selected ? t.primaryLight : '#fafafa',
                cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
              }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: t.primary, flexShrink: 0 }} />
                <div style={{ textAlign: 'left' as const }}>
                  <p style={{ fontSize: '12px', fontWeight: '600', color: t.accent, margin: 0 }}>{key}</p>
                  <p style={{ fontSize: '10px', color: t.primaryMid, margin: 0 }}>{t.primary}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* 저장 버튼 */}
      <button onClick={handleSave} disabled={saving} style={{
        width: '100%', padding: '14px', borderRadius: '14px',
        background: saved ? '#2E7D52' : 'var(--color-primary)',
        color: '#fff', fontSize: '14px', fontWeight: '600',
        border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
        marginBottom: '12px', fontFamily: 'inherit', transition: 'background 0.3s',
      }}>
        {saving ? '저장 중...' : saved ? '✓ 저장됨' : '변경사항 저장'}
      </button>

      {/* 계정 */}
      <div style={card}>
        <p style={{ ...label, fontWeight: '600', color: '#555', fontSize: '12px', marginBottom: '12px' }}>계정</p>
        <button onClick={handleLogout} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#E05070', fontSize: '14px', fontWeight: '600',
          padding: '4px 0', fontFamily: 'inherit',
        }}>
          로그아웃
        </button>
      </div>
    </div>
  )
}
