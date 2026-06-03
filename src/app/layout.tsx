import type { Metadata } from "next";
import "./globals.css";
import localFont from "next/font/local";

const pretendard = localFont({
  src: "../fonts/PretendardVariable.woff2",
  display: "swap",
  variable: "--font-pretendard",
});

export const metadata: Metadata = {
  title: "Spenlog",
  description: "AI 가계부 — 자연어로 기록하는 나의 소비",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className={pretendard.variable}>
      {/* font-pretendard 대신 pretendard.className을 직접 주입하여 확실하게 폰트를 적용합니다 */}
      <body className={`${pretendard.className} antialiased bg-[#FAF7F4] text-gray-900`}>
        {children}
      </body>
    </html>
  );
}