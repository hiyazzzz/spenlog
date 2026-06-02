import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css' // 최상위 app 폴더 바로 옆에 있는 globals.css를 정확히 바라봅니다.

const pretendard = localFont({
  src: '../fonts/PretendardVariable.woff2', // src/fonts/ 위치를 정확히 계산합니다.
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
      <body className="font-pretendard antialiased bg-[#FAF7F4] text-gray-900">{children}</body>
    </html>
  )}