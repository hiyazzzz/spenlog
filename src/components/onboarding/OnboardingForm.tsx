'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Step = 'name' | 'income' | 'goal'
const STEPS: Step[] = ['name', 'income', 'goal']

const NAME_SUGGESTIONS = [
  '데굴데굴 도토리', '반짝반짝 별', '폴짝폴짝 토끼',
  '살금살금 고양이', '두근두근 하트', '알뜰살뜰 다람쥐',
]

interface Props { userId: string; email: string }

export default function OnboardingForm({ userId, email }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState<Step>('name')
  const [values, setValues] = useState({ name: '', income: '', goal: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const stepIdx = STEPS.indexOf(step)

  function get() { return step === 'name' ? values.name : step === 'income' ? values.income : values.goal }
  function set(v: string) {
    setError('')
    setValues(prev => ({ ...prev, [step === 'goal' ? 'goal' : step]: v }))
  }

  async function handleNext() {
    const v = get().trim()
    if (!v) return
    if (step === 'name' && v.length > 12) { setError('닉네임은 12자 이하로 입력해 주세요.'); return }
    if (stepIdx < STEPS.length - 1) {
      setStep(STEPS[stepIdx + 1])
    } else {
      setSaving(true)
      const income = parseInt(values.income.replace(/,/g, '')) * 10000 || 0
      const saving_goal = parseInt(values.goal.replace(/,/g, '')) * 10000 || 0
      const { error: err } = await supabase.from('users').upsert({
        id: userId,
        email,
        name: values.name.trim(),
        income,
        saving_goal,
        theme: 'Burgundy',
      })
      if (err) { setError('저장 중 오류가 발생했어요: ' + err.message); setSaving(false); return }
      router.push('/setup/assets-intro')
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
      <div style={{ display: 'flex', gap: '6px', marginBottom: '36px' }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{
            flex: 1, height: '4px', borderRadius: '2px',
            background: i <= stepIdx ? '#6B1E2E' : '#EDE3E5',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>

      {step === 'name' && (
        <>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#6B1E2E', marginBottom: '6px' }}>
            어떻게 불러드릴까요?
          </h1>
          <p style={{ fontSize: '14px', color: '#B8A8AC', marginBottom: '28px' }}>
            스펜로그에서 사용할 닉네임을 정해주세요
          </p>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '14px' }}>
            <input type="text" placeholder="닉네임 입력" value={values.name}
              onChange={e => set(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleNext()}
              maxLength={12} style={inputStyle} autoFocus />
            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '8px' }}>
              {NAME_SUGGESTIONS.map(s => (
                <button key={s} onClick={() => set(s)} style={{
                  padding: '6px 12px', borderRadius: '20px',
                  border: '1.5px solid #EDE3E5',
                  background: values.name === s ? '#6B1E2E' : '#fff',
                  color: values.name === s ? '#fff' : '#9A7A80',
                  fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit',
                }}>{s}</button>
              ))}
            </div>
          </div>
        </>
      )}

      {step === 'income' && (
        <>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#6B1E2E', marginBottom: '6px' }}>
            한 달 수입이 얼마예요?
          </h1>
          <p style={{ fontSize: '14px', color: '#B8A8AC', marginBottom: '28px', lineHeight: 1.6 }}>
            예산 관리에 활용돼요.<br />
            나중에 설정에서 언제든지 수정할 수 있어요 😊
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="text" inputMode="numeric" pattern="[0-9]*"
              placeholder="숫자만 입력"
              value={values.income}
              onChange={e => { const raw = e.target.value.replace(/[^0-9]/g, ''); set(raw) }}
              onKeyDown={e => e.key === 'Enter' && handleNext()}
              style={{ ...inputStyle, flex: 1 }} autoFocus
            />
            <span style={{ fontSize: '15px', color: '#6B1E2E', fontWeight: '600', whiteSpace: 'nowrap' as const }}>만 원</span>
          </div>
          <p style={{ fontSize: '12px', color: '#C4A0A8', marginTop: '8px' }}>
            정확하지 않아도 괜찮아요. 대략적인 금액을 입력해 주세요.
          </p>
        </>
      )}

      {step === 'goal' && (
        <>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#6B1E2E', marginBottom: '6px' }}>
            한 달에 얼마씩 모아볼까요?
          </h1>
          <p style={{ fontSize: '14px', color: '#B8A8AC', marginBottom: '28px', lineHeight: 1.6 }}>
            이번 달 저축 목표를 설정해요.<br />
            저축 목표는 언제든지 유지하거나 수정할 수 있어요 😊
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="text" inputMode="numeric" pattern="[0-9]*"
              placeholder="숫자만 입력"
              value={values.goal}
              onChange={e => { const raw = e.target.value.replace(/[^0-9]/g, ''); set(raw) }}
              onKeyDown={e => e.key === 'Enter' && handleNext()}
              style={{ ...inputStyle, flex: 1 }} autoFocus
            />
            <span style={{ fontSize: '15px', color: '#6B1E2E', fontWeight: '600', whiteSpace: 'nowrap' as const }}>만 원</span>
          </div>
          <p style={{ fontSize: '12px', color: '#C4A0A8', marginTop: '8px' }}>
            정확하지 않아도 괜찮아요. 언제든지 바꿀 수 있어요.
          </p>
        </>
      )}

      {error && (
        <p style={{ fontSize: '13px', color: '#E05070', marginTop: '10px' }}>{error}</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px', marginTop: '24px' }}>
        <button onClick={handleNext} disabled={saving || !get().trim()} style={{
          width: '100%', padding: '16px', borderRadius: '16px',
          background: saving || !get().trim() ? '#C4A0A8' : '#6B1E2E',
          color: '#fff', fontSize: '15px', fontWeight: '600',
          border: 'none', cursor: saving || !get().trim() ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
        }}>
          {saving ? '저장 중...' : stepIdx < STEPS.length - 1 ? '다음 →' : '시작하기'}
        </button>
        {stepIdx > 0 && (
          <button onClick={() => setStep(STEPS[stepIdx - 1])} style={{
            background: 'none', border: 'none', color: '#B8A8AC',
            fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
          }}>← 이전</button>
        )}
      </div>
    </div>
  )
}
