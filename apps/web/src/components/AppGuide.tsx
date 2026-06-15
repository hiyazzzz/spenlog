'use client'
import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

// TODO: AppGuide(설정 > "앱 가이드 다시 보기"에서 수동 호출, 바텀시트 형태)와
// src/components/onboarding/GuideOverlay.tsx(최초 온보딩 시 자동 노출, 실제 UI 요소 하이라이트)는
// 둘 다 guide_completed 플래그를 갱신하지만 UI/트리거가 달라 별도 컴포넌트로 유지함.
// 향후 가이드 콘텐츠 통합 필요 시 검토 (spenlog_app_guide_spec_v1.md 참고)

interface AppGuideProps {
  onClose: () => void
}

const STEPS = [
  {
    emoji: '✍️',
    title: 'AI 자연어 입력',
    desc: '홈 화면 입력창에 "스타벅스 5500원 카드" 처럼 자유롭게 입력하세요.\nAI가 카테고리·금액·결제수단을 자동으로 분류해요.',
    img: null,
    tip: '💡 영수증 사진을 찍어서 올리면 OCR로 자동 인식해요!',
  },
  {
    emoji: '🏠',
    title: '홈 대시보드',
    desc: '저축 목표 달성률, 예산 현황, 최근 지출을 한눈에 확인할 수 있어요.\n상단 커버 이미지와 카드 이미지도 직접 꾸밀 수 있어요.',
    img: null,
    tip: '💡 저축 진행 바를 누르면 이번 달 상세 내역으로 이동해요.',
  },
  {
    emoji: '📊',
    title: '내역 & 예산',
    desc: '하단 탭의 📋 내역에서 지출/수입 전체 내역을 검색하고 필터링할 수 있어요.\n💰 예산 탭에서 카테고리별 월 예산을 설정해보세요.',
    img: null,
    tip: '💡 예산 탭에서 AI 추천 받기로 지출 패턴에 맞는 예산을 자동 설정할 수 있어요.',
  },
  {
    emoji: '💳',
    title: '자산 & 고정비',
    desc: '🏦 자산 탭에서 카드·계좌를 등록하고 고정비를 관리하세요.\n매달 반복되는 고정비를 등록하면 루틴 알림을 받을 수 있어요.',
    img: null,
    tip: '💡 자산 탭 상단 배너로 이번 달 미처리 고정비를 빠르게 확인해요.',
  },
  {
    emoji: '📈',
    title: '월간 리포트 & 설정',
    desc: '📊 리포트 탭에서 월별 지출 분석과 AI 코치의 맞춤 조언을 받아보세요.\n⚙️ 설정에서 테마, 알림, 데이터 내보내기를 관리할 수 있어요.',
    img: null,
    tip: '💡 리포트 하단의 "AI 코치에게 물어보기"를 눌러보세요!',
  },
]

export default function AppGuide({ onClose }: AppGuideProps) {
  const [step, setStep] = useState(0)
  const [leaving, setLeaving] = useState(false)

  async function finish() {
    // guide_completed 플래그 업데이트
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('users').update({ guide_completed: true }).eq('id', user.id)
      }
    } catch (_) {}
    handleClose()
  }

  function handleClose() {
    setLeaving(true)
    setTimeout(onClose, 280)
  }

  const isLast = step === STEPS.length - 1
  const current = STEPS[step]
  const progress = ((step + 1) / STEPS.length) * 100

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) handleClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        animation: leaving ? 'fadeOut 0.28s ease forwards' : 'fadeIn 0.28s ease',
      }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes fadeOut { from { opacity: 1 } to { opacity: 0 } }
        @keyframes slideUp { from { transform: translateY(40px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        @keyframes slideOut { from { transform: translateY(0); opacity: 1 } to { transform: translateY(40px); opacity: 0 } }
      `}</style>

      <div style={{
        background: 'var(--color-surface, #fff)',
        borderRadius: '24px 24px 0 0',
        width: '100%', maxWidth: 480,
        paddingBottom: 'env(safe-area-inset-bottom, 16px)',
        animation: leaving ? 'slideOut 0.28s ease forwards' : 'slideUp 0.28s ease',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
      }}>
        {/* 상단 핸들 + 닫기 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 0' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: '#e5e7eb', margin: '0 auto' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 16px 0' }}>
          <button onClick={handleClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af', padding: 4, lineHeight: 1 }}>
            ✕
          </button>
        </div>

        {/* 진행 바 */}
        <div style={{ padding: '0 20px 0', marginTop: -4 }}>
          <div style={{ height: 4, background: '#f3f4f6', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 2,
              background: 'var(--color-primary, #7c3aed)',
              width: `${progress}%`,
              transition: 'width 0.35s ease',
            }} />
          </div>
          <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'right', marginTop: 4 }}>
            {step + 1} / {STEPS.length}
          </p>
        </div>

        {/* 콘텐츠 */}
        <div style={{ padding: '16px 24px 8px', minHeight: 200 }}>
          <div style={{ fontSize: 52, textAlign: 'center', marginBottom: 12, lineHeight: 1 }}>
            {current.emoji}
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, textAlign: 'center', color: 'var(--color-text, #111827)', marginBottom: 12 }}>
            {current.title}
          </h2>
          <p style={{ fontSize: 14, color: 'var(--color-text-secondary, #6b7280)', lineHeight: 1.7, textAlign: 'center', whiteSpace: 'pre-line' }}>
            {current.desc}
          </p>
          {current.tip && (
            <div style={{
              marginTop: 16, padding: '10px 14px', borderRadius: 12,
              background: 'var(--color-primary-light, #f5f3ff)',
              fontSize: 13, color: 'var(--color-primary, #7c3aed)',
              lineHeight: 1.5, textAlign: 'left',
            }}>
              {current.tip}
            </div>
          )}
        </div>

        {/* 도트 인디케이터 */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '8px 0' }}>
          {STEPS.map((_, i) => (
            <button key={i} onClick={() => setStep(i)}
              style={{
                width: i === step ? 20 : 8, height: 8, borderRadius: 4, border: 'none',
                background: i === step ? 'var(--color-primary, #7c3aed)' : '#e5e7eb',
                cursor: 'pointer', padding: 0,
                transition: 'width 0.25s, background 0.25s',
              }} />
          ))}
        </div>

        {/* 버튼 */}
        <div style={{ padding: '8px 20px 20px', display: 'flex', gap: 10 }}>
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)}
              style={{
                flex: 1, padding: '13px 0', borderRadius: 14, border: '1.5px solid #e5e7eb',
                background: 'none', color: 'var(--color-text-secondary, #6b7280)',
                fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>
              이전
            </button>
          )}
          <button onClick={isLast ? finish : () => setStep(s => s + 1)}
            style={{
              flex: 3, padding: '13px 0', borderRadius: 14, border: 'none',
              background: 'var(--color-primary, #7c3aed)',
              color: '#fff', fontSize: 14, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
            {isLast ? '시작하기 🚀' : '다음'}
          </button>
        </div>
      </div>
    </div>
  )
}
