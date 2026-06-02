import type { Metadata } from 'next'
import localFont from 'next/font/local'
import '@/app/globals.css' // ◀ 무조건 src/app/globals.css를 정확히 찾아갑니다.

const pretendard = localFont({
  src: '../../fonts/PretendardVariable.woff2', // ◀ 괄호 폴더 특성을 고려해 기존 위치인 두 단계 바깥으로 고정합니다.
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