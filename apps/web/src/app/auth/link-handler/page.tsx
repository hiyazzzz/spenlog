'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Step = 'loading' | 'caseA_migrating' | 'caseB_conflict' | 'caseB_confirm_overwrite' | 'done' | 'error'

export default function LinkHandlerPage() {
  const supabase = createClient()
  const router = useRouter()
  const [step, setStep] = useState<Step>('loading')
  const [existingCount, setExistingCount] = useState(0)
  const [toast, setToast] = useState('')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  useEffect(() => {
    handleLink()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleLink() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const guestUserId = typeof window !== 'undefined'
        ? sessionStorage.getItem('guest_user_id')
        : null

      // 현재 구글 계정에 기존 지출 데이터가 있는지 확인
      const { count } = await supabase
        .from('expenses')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)

      const hasExisting = (count ?? 0) > 0

      if (!hasExisting && guestUserId && guestUserId !== user.id) {
        // 케이스 A: 신규 구글 계정 → 게스트 데이터 마이그레이션
        setStep('caseA_migrating')
        await migrateGuestData(guestUserId, user.id)
        sessionStorage.removeItem('guest_user_id')
        showToast('계정이 연동됐어요! 데이터가 안전하게 저장됩니다 ✨')
        setTimeout(() => router.replace('/'), 1500)
      } else if (hasExisting) {
        // 케이스 B: 기존 데이터 있음 → 선택 필요
        setExistingCount(count ?? 0)
        setStep('caseB_conflict')
      } else {
        // 게스트 데이터 없거나 같은 유저 → 그냥 홈으로
        sessionStorage.removeItem('guest_user_id')
        router.replace('/')
      }
    } catch (e) {
      console.error('[link-handler]', e)
      setStep('error')
    }
  }

  /**
   * 게스트(익명) 유저의 Supabase 데이터를 새 구글 계정으로 복사
   * RLS 제약으로 직접 update 불가 → API Route 경유
   */
  async function migrateGuestData(fromUserId: string, toUserId: string) {
    const res = await fetch('/api/migrate-guest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromUserId, toUserId }),
    })
    if (!res.ok) throw new Error('Migration failed')
  }

  async function handleKeepExisting() {
    // 케이스 B-1: 기존 계정 유지, 게스트 데이터 버림
    sessionStorage.removeItem('guest_user_id')
    showToast('기존 계정으로 연결됐어요')
    setTimeout(() => router.replace('/'), 1200)
  }

  async function handleOverwriteConfirm() {
    // 케이스 B-2: 기존 데이터 삭제 후 게스트 데이터로 덮어쓰기
    try {
      setStep('loading')
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const guestUserId = sessionStorage.getItem('guest_user_id')

      // 기존 데이터 전체 삭제
      await Promise.all([
        supabase.from('expenses').delete().eq('user_id', user.id),
        supabase.from('budgets').delete().eq('user_id', user.id),
        supabase.from('fixed_costs').delete().eq('user_id', user.id),
        supabase.from('cards').delete().eq('user_id', user.id),
        supabase.from('accounts').delete().eq('user_id', user.id),
        supabase.from('categories').delete().eq('user_id', user.id),
      ])

      // 게스트 데이터 마이그레이션
      if (guestUserId && guestUserId !== user.id) {
        await migrateGuestData(guestUserId, user.id)
      }
      sessionStorage.removeItem('guest_user_id')
      showToast('데이터가 업데이트됐어요')
      setTimeout(() => router.replace('/'), 1200)
    } catch (e) {
      console.error('[overwrite]', e)
      setStep('caseB_conflict')
    }
  }

  // ── UI ──────────────────────────────────────────────
  if (step === 'loading' || step === 'caseA_migrating') {
    return (
      <div style={{
        minHeight: '100svh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16,
        background: 'var(--color-bg)',
      }}>
        <div style={{
          width: 48, height: 48, border: '4px solid #e5e7eb',
          borderTopColor: 'var(--color-primary)', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <p style={{ fontSize: 14, color: '#6b7280' }}>
          {step === 'caseA_migrating' ? '데이터를 안전하게 옮기는 중...' : '계정 확인 중...'}
        </p>
      </div>
    )
  }

  if (step === 'error') {
    return (
      <div style={{
        minHeight: '100svh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24,
        background: 'var(--color-bg)',
      }}>
        <p style={{ fontSize: 16, fontWeight: 700, color: '#1f2937' }}>연동 중 오류가 발생했어요</p>
        <button
          onClick={() => router.replace('/')}
          style={{
            padding: '12px 24px', borderRadius: 12, border: 'none',
            background: 'var(--color-primary)', color: '#fff',
            fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}>
          홈으로 이동
        </button>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100svh', background: 'var(--color-bg)', display: 'flex', alignItems: 'flex-end' }}>
      {/* 토스트 */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          background: '#1f2937', color: '#fff', padding: '10px 18px',
          borderRadius: 20, fontSize: 13, zIndex: 9999, whiteSpace: 'nowrap',
        }}>{toast}</div>
      )}

      {/* 케이스 B: 충돌 바텀시트 */}
      <div style={{
        width: '100%', background: '#fff', borderRadius: '20px 20px 0 0',
        padding: '24px 20px 48px', boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#e5e7eb' }} />
        </div>

        {step === 'caseB_conflict' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <p style={{ fontSize: 20, marginBottom: 8 }}>⚠️</p>
              <p style={{ fontSize: 17, fontWeight: 700, color: '#1f2937', marginBottom: 6 }}>
                이미 가입된 계정이에요
              </p>
              <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>
                기존 계정에<br />
                지출 내역 <strong style={{ color: '#1f2937' }}>{existingCount}건</strong>이 있어요
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={handleKeepExisting}
                style={{
                  width: '100%', padding: '14px', borderRadius: 14, border: 'none',
                  background: 'var(--color-primary)', color: '#fff',
                  fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                기존 계정으로 시작하기
              </button>
              <button
                onClick={() => setStep('caseB_confirm_overwrite')}
                style={{
                  width: '100%', padding: '12px', borderRadius: 14,
                  background: '#f9fafb', border: '1px solid #e5e7eb',
                  color: '#6b7280', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                게스트 데이터로 덮어쓰기
              </button>
            </div>
          </>
        )}

        {step === 'caseB_confirm_overwrite' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <p style={{ fontSize: 20, marginBottom: 8 }}>⚠️</p>
              <p style={{ fontSize: 17, fontWeight: 700, color: '#1f2937', marginBottom: 6 }}>
                정말 덮어쓸까요?
              </p>
              <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>
                기존 지출 내역 <strong style={{ color: '#ef4444' }}>{existingCount}건</strong>이<br />
                모두 삭제됩니다.<br />
                <strong>이 작업은 되돌릴 수 없어요.</strong>
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setStep('caseB_conflict')}
                style={{
                  flex: 1, padding: '14px', borderRadius: 14,
                  background: '#f3f4f6', color: '#374151',
                  border: 'none', fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                취소
              </button>
              <button
                onClick={handleOverwriteConfirm}
                style={{
                  flex: 1, padding: '14px', borderRadius: 14,
                  background: '#ef4444', color: '#fff',
                  border: 'none', fontSize: 14, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                덮어쓰기
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
