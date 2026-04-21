import type { Metadata } from "next";
import { Suspense } from "react";
import HomeContent from "@/components/HomeContent";
import HomePushOptInBannerGate from "@/components/HomePushOptInBannerGate";
import PromotionCarousel from "@/components/promotions/PromotionCarousel";
import SiteHeader from "@/components/SiteHeader";
import Container from "@/components/ui/Container";
import { CAMPUS_DIRECTORY, getCampusPageHref } from "@/lib/campuses";
import { getHomePromotionSlides } from "@/lib/promotions/events";
import {
  SITE_ALTERNATE_NAMES,
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_NAME,
  SITE_RSS_URL,
  SITE_TITLE,
} from "@/lib/site";
import { buildSiteUrl, createCanonicalAlternates } from "@/lib/seo";
import { getHeaderSession } from "@/lib/header-session";
import { getSignedUserSession } from "@/lib/user-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const revalidate = 300;

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  alternates: {
    ...createCanonicalAlternates("/"),
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
  const [headerSession, member] = await Promise.all([
    getHeaderSession(session?.userId ?? undefined),
    session?.userId
      ? getSupabaseAdminClient()
          .from("members")
          .select("year,campus")
          .eq("id", session.userId)
          .maybeSingle()
          .then(({ data }) => data)
      : Promise.resolve(null),
  ]);
  const resolvedPromotionSlides = await getHomePromotionSlides({
    authenticated: Boolean(session?.userId),
    year: typeof member?.year === "number" ? member.year : null,
    campus: typeof member?.campus === "string" ? member.campus : null,
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: SITE_NAME,
        alternateName: SITE_ALTERNATE_NAMES,
        url: buildSiteUrl("/"),
        description: SITE_DESCRIPTION,
      },
      {
        "@type": "Organization",
        name: SITE_NAME,
        url: buildSiteUrl("/"),
        description: SITE_DESCRIPTION,
        logo: buildSiteUrl("/icon.svg"),
      },
      {
        "@type": "ItemList",
        name: "SSAFY 캠퍼스별 제휴 랜딩 페이지",
        itemListElement: CAMPUS_DIRECTORY.map((campus, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: buildSiteUrl(getCampusPageHref(campus.slug)),
          name: `${campus.fullLabel} 제휴 혜택`,
        })),
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
          <PromotionCarousel slides={resolvedPromotionSlides} headingLevel="h1" className="mt-0" />
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
