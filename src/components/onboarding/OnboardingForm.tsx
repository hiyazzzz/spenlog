'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Step = 'name' | 'income' | 'goal'

const STEPS: Step[] = ['name', 'income', 'goal']

const STEP_INFO = {
  name: { title: '어떻게 불러드릴까요?', sub: '닉네임을 설정해 주세요', placeholder: '닉네임 입력 (예: 절약왕)', label: '닉네임', type: 'text' },
  income: { title: '한 달 수입이 얼마예요?', sub: '예산 관리에 활용돼요', placeholder: '월 수입 (원)', label: '월 수입', type: 'number' },
  goal: { title: '얼마나 모으고 싶으세요?', sub: '이번 달 저축 목표를 설정해요', placeholder: '저축 목표 (원)', label: '저축 목표', type: 'number' },
}

const SUGGESTIONS = {
  name: ['절약왕', '짠돌이', '저축요정', '현명한소비자', '가계부장인'],
  income: ['2,000,000', '3,000,000', '4,000,000', '5,000,000'],
  goal: ['200,000', '500,000', '1,000,000', '2,000,000'],
}

export default function OnboardingForm({ userId }: { userId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState<Step>('name')
  const [values, setValues] = useState({ name: '', income: '', goal: '' })
  const [saving, setSaving] = useState(false)

  const stepIdx = STEPS.indexOf(step)
  const info = STEP_INFO[step]
  const value = step === 'name' ? values.name : step === 'income' ? values.income : values.goal

  function setValue(v: string) {
    setValues(prev => ({ ...prev, [step === 'goal' ? 'goal' : step]: v }))
  }

  async function handleNext() {
    if (!value.trim()) return
    if (stepIdx < STEPS.length - 1) {
      setStep(STEPS[stepIdx + 1])
    } else {
      setSaving(true)
      const income = parseInt(values.income.replace(/,/g, '')) || 0
      const saving_goal = parseInt(values.goal.replace(/,/g, '')) || 0
      await supabase.from('users').upsert({
        id: userId,
        name: values.name.trim(),
        income,
        saving_goal,
      })
      router.refresh()
      router.push('/')
    }
  }

  const inputStyle = {
    width: '100%', padding: '16px', borderRadius: '16px',
    border: '1.5px solid #EDE3E5', background: '#fff',
    fontSize: '16px', color: '#3D2020', outline: 'none',
    boxSizing: 'border-box' as const, fontFamily: 'inherit',
  }

  return (
    <div>
      {/* 진행 바 */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '32px' }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{
            flex: 1, height: '4px', borderRadius: '2px',
            background: i <= stepIdx ? '#6B1E2E' : '#EDE3E5',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>

      <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#6B1E2E', marginBottom: '6px' }}>
        {info.title}
      </h1>
      <p style={{ fontSize: '14px', color: '#B8A8AC', marginBottom: '28px' }}>{info.sub}</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <input
          type={info.type}
          placeholder={info.placeholder}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleNext()}
          maxLength={step === 'name' ? 12 : undefined}
          style={inputStyle}
          autoFocus
        />

        {/* 추천값 */}
        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '8px' }}>
          {SUGGESTIONS[step].map(s => (
            <button key={s} onClick={() => setValue(s)} style={{
              padding: '6px 14px', borderRadius: '20px',
              border: '1.5px solid #EDE3E5',
              background: value === s ? '#6B1E2E' : '#fff',
              color: value === s ? '#fff' : '#9A7A80',
              fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              {step === 'name' ? s : `${s}원`}
            </button>
          ))}
        </div>

        <button onClick={handleNext} disabled={saving || !value.trim()} style={{
          width: '100%', padding: '16px', borderRadius: '16px',
          background: saving || !value.trim() ? '#C4A0A8' : '#6B1E2E',
          color: '#fff', fontSize: '15px', fontWeight: '600',
          border: 'none', cursor: saving || !value.trim() ? 'not-allowed' : 'pointer',
          marginTop: '8px', fontFamily: 'inherit',
        }}>
          {saving ? '저장 중...' : stepIdx < STEPS.length - 1 ? '다음 →' : '스펜로그 시작하기 🎉'}
        </button>

        {stepIdx > 0 && (
          <button onClick={() => setStep(STEPS[stepIdx - 1])} style={{
            background: 'none', border: 'none', color: '#B8A8AC',
            fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
          }}>
            ← 이전
          </button>
        )}
      </div>
    </div>
  )
}
