'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function OnboardingForm({ userId }: { userId: string }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    await supabase.from('users').upsert({
      id: userId,
      name: name.trim(),
    })
    router.refresh()
    router.push('/')
  }

  const suggestions = ['절약왕', '짠돌이', '저축요정', '현명한소비자', '가계부장인']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <input
        type="text"
        placeholder="닉네임 입력 (예: 절약왕)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        maxLength={12}
        style={{
          width: '100%',
          padding: '16px',
          borderRadius: '16px',
          border: '1.5px solid #EDE3E5',
          background: '#fff',
          fontSize: '16px',
          color: '#3D2020',
          outline: 'none',
          boxSizing: 'border-box',
          fontFamily: 'inherit',
        }}
      />

      {/* 추천 닉네임 */}
      <div>
        <p style={{ fontSize: '12px', color: '#C4A0A8', marginBottom: '8px' }}>추천 닉네임</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => setName(s)}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                border: '1.5px solid #EDE3E5',
                background: name === s ? '#6B1E2E' : '#fff',
                color: name === s ? '#fff' : '#9A7A80',
                fontSize: '13px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving || !name.trim()}
        style={{
          width: '100%',
          padding: '16px',
          borderRadius: '16px',
          background: saving || !name.trim() ? '#C4A0A8' : '#6B1E2E',
          color: '#fff',
          fontSize: '15px',
          fontWeight: '600',
          border: 'none',
          cursor: saving || !name.trim() ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
          marginTop: '8px',
        }}
      >
        {saving ? '저장 중...' : '스펜로그 시작하기 →'}
      </button>
    </div>
  )
}
