import { partnerRepository } from "@/lib/repositories";
import HomeView from "@/components/HomeView";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import { getHeaderSession } from "@/lib/header-session";

export const revalidate = 300;

export default async function Home() {
  const [categories, partners, headerSession] = await Promise.all([
    partnerRepository.getCategories(),
    partnerRepository.getPartners(),
    getHeaderSession(),
  ]);

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
      />
    </>
  );
}
