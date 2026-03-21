import type { Metadata } from "next";
import ThemeProvider from "@/components/ThemeProvider";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://ssartnership.vercel.app";

export const metadata: Metadata = {
  title: "SSAFY 제휴 혜택 플랫폼 - SSARTNERSHIP",
  description: "카테고리별 제휴 업체와 혜택을 카드뷰로 확인하세요.",
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "SSAFY 제휴 혜택 플랫폼 - SSARTNERSHIP",
    description: "카테고리별 제휴 업체와 혜택을 카드뷰로 확인하세요.",
    url: "/",
    siteName: "SSARTNERSHIP",
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SSAFY 제휴 혜택 플랫폼 - SSARTNERSHIP",
    description: "카테고리별 제휴 업체와 혜택을 카드뷰로 확인하세요.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
