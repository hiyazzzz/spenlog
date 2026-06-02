import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css' // ◀ 프로젝트 전체에 스타일을 정상적으로 공급합니다.

const pretendard = localFont({
  src: '../fonts/PretendardVariable.woff2',
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
      {/* 바디 전체에 폰트와 부드러운 기본 배경색을 입혀줍니다. */}
      <body className="font-pretendard antialiased bg-[#FAF7F4] text-gray-900">
        {children}
      </body>
    </html>
  )
}