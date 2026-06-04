'use client'
import { useRouter } from 'next/navigation'

export default function AssetsIntroPage() {
  const router = useRouter()

  return (
    <div style={{
      minHeight: '100vh', background: '#FAF7F4',
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
      padding: '0 24px', maxWidth: '420px', margin: '0 auto',
    }}>
      <div style={{ marginBottom: '32px' }}>
        <p style={{ fontSize: '28px', marginBottom: '8px' }}>💰</p>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#6B1E2E', marginBottom: '8px' }}>
          자산을 등록해볼까요?
        </h1>
        <p style={{ fontSize: '14px', color: '#B8A8AC', lineHeight: 1.7 }}>
          계좌, 카드, 고정비를 등록하면<br />
          더 정확한 현금흐름을 파악할 수 있어요.<br />
          나중에 자산 탭에서 언제든지 수정 가능해요 😊
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <button
          onClick={() => router.push('/setup/assets')}
          style={{
            width: '100%', padding: '16px', borderRadius: '16px',
            background: '#6B1E2E', color: '#fff',
            fontSize: '15px', fontWeight: '600', border: 'none',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          ✨ AI와 함께 자산 등록하기
        </button>

        <button
          onClick={() => router.push('/')}
          style={{
            width: '100%', padding: '14px', borderRadius: '16px',
            background: 'transparent', color: '#B8A8AC',
            fontSize: '14px', fontWeight: '500', border: '1.5px solid #EDE3E5',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          나중에 직접 입력할게요
        </button>
      </div>

      <p style={{ fontSize: '11px', color: '#CCC', textAlign: 'center', marginTop: '20px' }}>
        자산 탭 → AI와 함께 다시 입력하기 로 언제든 돌아올 수 있어요
      </p>
    </div>
  )
}
