import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Plan Do See Diary",
  description: "안석주의 실제 계획과 실행, 회고를 서버 DB에 기록하는 공개 다이어리",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
