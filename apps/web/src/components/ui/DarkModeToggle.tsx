'use client'
import { useEffect, useState } from 'react'

export default function DarkModeToggle() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('spenlog-dark')
    if (saved === 'true') {
      setDark(true)
      document.documentElement.setAttribute('data-theme', 'dark')
    }
  }, [])

  function toggle() {
    const next = !dark
    setDark(next)
    localStorage.setItem('spenlog-dark', String(next))
    document.documentElement.setAttribute('data-theme', next ? 'dark' : '')
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
      <div>
        <p style={{ fontSize: '14px', fontWeight: '500', color: 'var(--color-text)', margin: 0 }}>다크모드</p>
        <p style={{ fontSize: '11px', color: 'var(--color-text-sub)', margin: '2px 0 0' }}>어두운 화면으로 전환</p>
      </div>
      <button onClick={toggle} style={{
        width: '48px', height: '26px', borderRadius: '13px',
        background: dark ? 'var(--color-primary)' : '#ddd',
        border: 'none', cursor: 'pointer', position: 'relative',
        transition: 'background 0.2s',
      }}>
        <div style={{
          width: '20px', height: '20px', borderRadius: '50%',
          background: '#fff', position: 'absolute', top: '3px',
          left: dark ? '25px' : '3px', transition: 'left 0.2s',
        }} />
      </button>
    </div>
  )
}
