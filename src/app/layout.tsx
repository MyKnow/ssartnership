import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SSAFY 15기 제휴 혜택",
  description: "카테고리별 제휴 업체와 혜택을 카드뷰로 확인하세요.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="font-sans text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
