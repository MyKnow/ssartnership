import type { Metadata, Viewport } from "next";
import ThemeProvider from "@/components/ThemeProvider";
import RouteScrollManager from "@/components/RouteScrollManager";
import { ToastProvider } from "@/components/ui/Toast";
import {
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_NAME,
  SITE_RSS_URL,
  SITE_THEME_COLOR_DARK,
  SITE_THEME_COLOR_LIGHT,
  SITE_TITLE,
} from "@/lib/site";
import { DEFAULT_OPEN_GRAPH_IMAGE, getMetadataBase } from "@/lib/seo";
import PwaProvider from "@/components/PwaProvider";
import SelfHostedWebVitals from "@/components/SelfHostedWebVitals";
import { shouldLoadSelfHostedTelemetry } from "@/lib/telemetry-mode";
// Pretendard는 설치된 패키지의 unicode-range 분할(dynamic-subset) CSS를 번들해
// `/_next/static/media`에서 자체 서빙한다. 외부 CDN 렌더 차단 요청을 만들지 않고,
// 패밀리명 "Pretendard Variable"이 globals.css의 --font-sans 1순위와 일치한다.
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  metadataBase: getMetadataBase(),
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  // Each indexable page declares its own canonical path. A root canonical would
  // be inherited by every segment and point unrelated pages at the home page.
  alternates: {
    types: {
      "application/rss+xml": SITE_RSS_URL,
    },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: SITE_NAME,
  },
  // Title and description are left out on purpose: Next.js fills og:title,
  // og:description, and the Twitter card from each page's own metadata, so
  // pages without an openGraph block do not advertise the home page text.
  openGraph: {
    siteName: SITE_NAME,
    locale: "ko_KR",
    type: "website",
    images: [DEFAULT_OPEN_GRAPH_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
  },
  keywords: SITE_KEYWORDS,
  applicationName: SITE_NAME,
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: SITE_THEME_COLOR_LIGHT },
    { media: "(prefers-color-scheme: dark)", color: SITE_THEME_COLOR_DARK },
  ],
  colorScheme: "light dark",
  viewportFit: "cover",
};

const loadSelfHostedTelemetry = shouldLoadSelfHostedTelemetry({
  NEXT_PUBLIC_DATA_SOURCE: process.env.NEXT_PUBLIC_DATA_SOURCE,
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className="bg-background text-foreground antialiased">
        <ThemeProvider>
          <ToastProvider>
            <PwaProvider />
            <RouteScrollManager />
            {children}
          </ToastProvider>
        </ThemeProvider>
        {loadSelfHostedTelemetry ? <SelfHostedWebVitals /> : null}
      </body>
    </html>
  );
}
