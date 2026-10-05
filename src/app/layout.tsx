import type { Metadata, Viewport } from "next";
import ThemeProvider from "@/components/ThemeProvider";
import RouteScrollManager from "@/components/RouteScrollManager";
import { ToastProvider } from "@/components/ui/Toast";
import {
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_NAME,
  SITE_RSS_URL,
  SITE_TITLE,
} from "@/lib/site";
import { DEFAULT_OPEN_GRAPH_IMAGE, getMetadataBase } from "@/lib/seo";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import PwaProvider from "@/components/PwaProvider";
import SelfHostedWebVitals from "@/components/SelfHostedWebVitals";
import { shouldLoadSelfHostedTelemetry } from "@/lib/telemetry-mode";
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
    { media: "(prefers-color-scheme: light)", color: "#f4f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#07101d" },
  ],
  colorScheme: "light dark",
  viewportFit: "cover",
};

const shouldLoadVercelTelemetry = process.env.VERCEL === "1";
const loadSelfHostedTelemetry = shouldLoadSelfHostedTelemetry({
  VERCEL: process.env.VERCEL,
  NEXT_PUBLIC_DATA_SOURCE: process.env.NEXT_PUBLIC_DATA_SOURCE,
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css"
        />
      </head>
      <body className="bg-background text-foreground antialiased">
        <ThemeProvider>
          <ToastProvider>
            <PwaProvider />
            <RouteScrollManager />
            {children}
          </ToastProvider>
        </ThemeProvider>
        {shouldLoadVercelTelemetry ? (
          <>
            <Analytics />
            <SpeedInsights />
          </>
        ) : loadSelfHostedTelemetry ? <SelfHostedWebVitals /> : null}
      </body>
    </html>
  );
}
