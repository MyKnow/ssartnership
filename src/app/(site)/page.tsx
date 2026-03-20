import { partnerRepository } from "@/lib/repositories";
import HomeView from "@/components/HomeView";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [categories, partners] = await Promise.all([
    partnerRepository.getCategories(),
    partnerRepository.getPartners(),
  ]);

  return <HomeView categories={categories} partners={partners} />;
}
