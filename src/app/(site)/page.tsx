import { partnerRepository } from "@/lib/repositories";
import HomeView from "@/components/HomeView";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

export const revalidate = 300;

export default async function Home() {
  const [categories, partners] = await Promise.all([
    partnerRepository.getCategories(),
    partnerRepository.getPartners(),
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomeView categories={categories} partners={partners} />
    </>
  );
}
