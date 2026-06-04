import type { Metadata } from "next";
import "./globals.css";
import localFont from "next/font/local";
import DarkModeInit from "@/components/ui/DarkModeInit";

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body className={`${pretendard.className} antialiased`} style={{ background: 'var(--color-bg)' }}>
        <DarkModeInit />
        {children}
      </body>
    </html>
  );
}
