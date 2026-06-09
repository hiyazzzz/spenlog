'use client'
import { useRouter } from 'next/navigation'

export default function BudgetBackButton() {
  const router = useRouter()
  return (
    <button
      onClick={() => router.back()}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        padding: '4px 8px 4px 0', display: 'flex', alignItems: 'center',
        gap: 4, color: 'var(--color-accent)', fontSize: 14, fontFamily: 'inherit',
      }}
    >
      <span style={{ fontSize: 18, lineHeight: 1 }}>‹</span>
      <span>뒤로</span>
    </button>
  )
}
