import { partnerRepository } from "@/lib/repositories";
import HomeView from "@/components/HomeView";

export const revalidate = 300;
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://ssartnership.vercel.app";

export default async function Home() {
  const [categories, partners] = await Promise.all([
    partnerRepository.getCategories(),
    partnerRepository.getPartners(),
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "SSARTNERSHIP",
    url: siteUrl,
    description: "SSAFY 15기 서울 캠퍼스 제휴 혜택 안내",
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
