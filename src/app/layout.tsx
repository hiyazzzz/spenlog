import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Spenlog',
  description: 'AI 가계부 — 자연어로 기록하는 나의 소비',
  manifest: '/manifest.json',
  themeColor: '#6B1E2E',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}