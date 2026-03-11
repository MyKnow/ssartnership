import { partnerRepository } from "@/lib/repositories";
import AdminView from "@/components/AdminView";

export default async function AdminPage() {
  const [categories, partners] = await Promise.all([
    partnerRepository.getCategories(),
    partnerRepository.getPartners(),
  ]);

  return <AdminView categories={categories} partners={partners} />;
}
