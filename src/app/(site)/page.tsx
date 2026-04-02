import type { Metadata } from "next";
import { partnerRepository } from "@/lib/repositories";
import HomeView from "@/components/HomeView";
import {
  SITE_ALTERNATE_NAMES,
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_NAME,
  SITE_TITLE,
  SITE_URL,
} from "@/lib/site";
import { getSignedUserSession } from "@/lib/user-auth";
import { getMemberPushPreferences, isPushConfigured } from "@/lib/push";

export const revalidate = 300;

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  alternates: {
    canonical: "/",
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
  const sessionPromise = getSignedUserSession();
  const [categories, session] = await Promise.all([
    partnerRepository.getCategories(),
    sessionPromise,
  ]);
  const partners = await partnerRepository.getPartners({
    authenticated: Boolean(session?.userId),
  });
  const headerSession = session?.userId ? { userId: session.userId } : null;
  const showPushOptInBanner =
    session?.userId && isPushConfigured()
      ? !(await getMemberPushPreferences(session.userId)).enabled
      : false;

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
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomeView
        categories={categories}
        partners={partners}
        initialSession={headerSession}
        viewerAuthenticated={Boolean(session?.userId)}
        showPushOptInBanner={showPushOptInBanner}
      />
    </>
  );
}
