import type { Metadata } from "next";
import { Suspense } from "react";
import HeroSection from "@/components/HeroSection";
import HomeContent from "@/components/HomeContent";
import HomePushOptInBannerGate from "@/components/HomePushOptInBannerGate";
import SiteHeader from "@/components/SiteHeader";
import Container from "@/components/ui/Container";
import { HOME_COPY } from "@/lib/content";
import {
  SITE_ALTERNATE_NAMES,
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_NAME,
  SITE_RSS_URL,
  SITE_TITLE,
  SITE_URL,
} from "@/lib/site";
import { getSignedUserSession } from "@/lib/user-auth";

export const revalidate = 300;

function renderLines(value: string) {
  const lines = value.split("\n");
  return lines.map((line, index) => (
    <span key={`${line}-${index}`}>
      {line}
      {index < lines.length - 1 ? <br /> : null}
    </span>
  ));
}

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  alternates: {
    canonical: "/",
    types: {
      "application/rss+xml": SITE_RSS_URL,
    },
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: "/",
    siteName: SITE_NAME,
    locale: "ko_KR",
    type: "website",
    images: [
      {
        url: "/icon-512.png",
        width: 512,
        height: 512,
        alt: SITE_TITLE,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/icon-512.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function Home() {
  const session = await getSignedUserSession();
  const headerSession = session?.userId ? { userId: session.userId } : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: SITE_NAME,
        alternateName: SITE_ALTERNATE_NAMES,
        url: SITE_URL,
        description: SITE_DESCRIPTION,
      },
      {
        "@type": "Organization",
        name: SITE_NAME,
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        logo: `${SITE_URL}/icon.svg`,
      },
    ],
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader initialSession={headerSession} />
      <main>
        <Container className="pb-16 pt-10" size="wide">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
          <HeroSection
            eyebrow={HOME_COPY.heroEyebrow}
            title={HOME_COPY.heroTitle}
            description={renderLines(HOME_COPY.heroDescription)}
          />
          <Suspense fallback={null}>
            <HomePushOptInBannerGate memberId={session?.userId ?? null} />
          </Suspense>
          <Suspense fallback={null}>
            <HomeContent viewerAuthenticated={Boolean(session?.userId)} />
          </Suspense>
        </Container>
      </main>
    </div>
  );
}
