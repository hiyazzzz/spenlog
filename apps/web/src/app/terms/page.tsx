'use client'
import { useRouter } from 'next/navigation'

export default function TermsPage() {
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
        <h1 style={{ fontSize: 16, fontWeight: 700, color: '#1f2937' }}>이용약관</h1>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8" style={{ color: '#374151', fontSize: 14, lineHeight: 1.8 }}>
        {/* TODO: 실제 이용약관 내용으로 교체 예정 */}
        <p style={{ marginBottom: 16, color: '#9ca3af', fontSize: 12 }}>최종 수정일: 2026-06-15</p>

        <h2 style={{ fontSize: 15, fontWeight: 700, marginTop: 24, marginBottom: 8, color: '#1f2937' }}>제1조 (목적)</h2>
        <p style={{ marginBottom: 16 }}>
          이 약관은 Spenlog(이하 "회사")가 제공하는 가계부 서비스(이하 "서비스")의 이용과 관련하여
          회사와 이용자 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.
        </p>

        <h2 style={{ fontSize: 15, fontWeight: 700, marginTop: 24, marginBottom: 8, color: '#1f2937' }}>제2조 (서비스의 제공)</h2>
        <p style={{ marginBottom: 16 }}>
          회사는 AI 기반 자연어 입력을 통한 지출 기록, 예산 관리, 리포트 제공 등의 서비스를 제공합니다.
          서비스의 내용은 회사의 정책에 따라 변경될 수 있습니다.
        </p>

        <h2 style={{ fontSize: 15, fontWeight: 700, marginTop: 24, marginBottom: 8, color: '#1f2937' }}>제3조 (이용자의 의무)</h2>
        <p style={{ marginBottom: 16 }}>
          이용자는 서비스 이용 시 관계 법령과 이 약관의 규정을 준수해야 하며,
          타인의 정보를 도용하거나 서비스를 부정한 목적으로 사용해서는 안 됩니다.
        </p>

        <h2 style={{ fontSize: 15, fontWeight: 700, marginTop: 24, marginBottom: 8, color: '#1f2937' }}>제4조 (계약 해지 및 이용 제한)</h2>
        <p style={{ marginBottom: 16 }}>
          이용자는 언제든지 설정 화면을 통해 회원 탈퇴를 요청할 수 있으며,
          회사는 이용자가 본 약관을 위반한 경우 서비스 이용을 제한할 수 있습니다.
        </p>

        <h2 style={{ fontSize: 15, fontWeight: 700, marginTop: 24, marginBottom: 8, color: '#1f2937' }}>제5조 (책임의 한계)</h2>
        <p style={{ marginBottom: 16 }}>
          회사는 AI 분석 결과의 정확성을 보장하지 않으며, 이용자의 재정적 의사결정에 대한
          최종 책임은 이용자 본인에게 있습니다.
        </p>

        <p style={{ marginTop: 32, color: '#9ca3af', fontSize: 12 }}>
          본 약관은 placeholder이며, 추후 정식 약관으로 교체될 예정입니다.
        </p>
      </div>
    </div>
  )
}
