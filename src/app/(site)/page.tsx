import { partnerRepository } from "@/lib/repositories";
import HomeView from "@/components/HomeView";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import { getSignedUserSession } from "@/lib/user-auth";
import { getMemberPushPreferences, isPushConfigured } from "@/lib/push";

export const revalidate = 300;

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
        alternateName: ["싸트너십", "SSAFY 제휴", "싸피 제휴"],
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
