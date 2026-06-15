'use client'
import { useRouter } from 'next/navigation'

export default function PrivacyPage() {
  const router = useRouter()

  return (
    <div style={{ minHeight: '100vh', background: '#FAF7F4' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '16px 16px', borderBottom: '1px solid #f0ece8',
      }}>
        <button onClick={() => router.back()} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 18, color: '#374151', padding: 4,
        }}>←</button>
        <h1 style={{ fontSize: 16, fontWeight: 700, color: '#1f2937' }}>개인정보처리방침</h1>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8" style={{ color: '#374151', fontSize: 14, lineHeight: 1.8 }}>
        {/* TODO: 실제 개인정보처리방침 내용으로 교체 예정 */}
        <p style={{ marginBottom: 16, color: '#9ca3af', fontSize: 12 }}>최종 수정일: 2026-06-15</p>

        <h2 style={{ fontSize: 15, fontWeight: 700, marginTop: 24, marginBottom: 8, color: '#1f2937' }}>1. 수집하는 개인정보 항목</h2>
        <p style={{ marginBottom: 16 }}>
          Spenlog(이하 "회사")는 회원가입 시 이메일 주소, 닉네임을 수집하며,
          서비스 이용 과정에서 지출/수입 내역, 예산, 자산 정보 등을 수집합니다.
        </p>

        <h2 style={{ fontSize: 15, fontWeight: 700, marginTop: 24, marginBottom: 8, color: '#1f2937' }}>2. 개인정보의 수집 및 이용 목적</h2>
        <p style={{ marginBottom: 16 }}>
          수집된 정보는 가계부 서비스 제공, AI 기반 지출 분석 및 추천, 알림 발송,
          서비스 개선을 위한 통계 분석 목적으로만 이용됩니다.
        </p>

        <h2 style={{ fontSize: 15, fontWeight: 700, marginTop: 24, marginBottom: 8, color: '#1f2937' }}>3. 개인정보의 보유 및 이용 기간</h2>
        <p style={{ marginBottom: 16 }}>
          회원 탈퇴 시 관련 법령에서 정한 기간을 제외하고 모든 개인정보는 지체 없이 파기됩니다.
        </p>

        <h2 style={{ fontSize: 15, fontWeight: 700, marginTop: 24, marginBottom: 8, color: '#1f2937' }}>4. 개인정보의 제3자 제공</h2>
        <p style={{ marginBottom: 16 }}>
          회사는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않으며,
          서비스 제공을 위해 필요한 경우(예: AI 분석을 위한 Gemini API, 인증을 위한 Supabase)
          최소한의 정보만 처리위탁합니다.
        </p>

        <h2 style={{ fontSize: 15, fontWeight: 700, marginTop: 24, marginBottom: 8, color: '#1f2937' }}>5. 이용자의 권리</h2>
        <p style={{ marginBottom: 16 }}>
          이용자는 언제든지 자신의 개인정보를 조회, 수정, 삭제할 수 있으며,
          설정 화면에서 회원 탈퇴를 통해 개인정보 삭제를 요청할 수 있습니다.
        </p>

        <h2 style={{ fontSize: 15, fontWeight: 700, marginTop: 24, marginBottom: 8, color: '#1f2937' }}>6. 개인정보 보호책임자</h2>
        <p style={{ marginBottom: 16 }}>
          개인정보 관련 문의는 아래 이메일로 연락해 주세요.<br />
          이메일: support@spenlog.app
        </p>

        <p style={{ marginTop: 32, color: '#9ca3af', fontSize: 12 }}>
          본 방침은 placeholder이며, 추후 정식 방침으로 교체될 예정입니다.
        </p>
      </div>
    </div>
  )
}
