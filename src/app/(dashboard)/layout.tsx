import type { Metadata } from 'next'
import localFont from 'next/font/local'
import '../../globals.css' // ◀ 점 두 개(../)를 하나 더 붙여서 수정!

const pretendard = localFont({
  src: '../../../fonts/PretendardVariable.woff2', // ◀ 점 두 개(../)를 하나 더 붙여서 수정!
  variable: '--font-pretendard',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Spenlog',
  description: 'AI 가계부 — 자연어로 기록하는 나의 소비',
  manifest: '/manifest.json',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body className="font-pretendard antialiased">{children}</body>
    </html>
  )}