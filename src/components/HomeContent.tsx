import HomeView from "@/components/HomeView";
import { partnerRepository } from "@/lib/repositories";
import { isWithinPeriod } from "@/lib/partner-utils";

export default async function HomeContent({
  viewerAuthenticated,
}: {
  viewerAuthenticated: boolean;
}) {
  const [categories, partners] = await Promise.all([
    partnerRepository.getCategories(),
    partnerRepository.getPartners({
      authenticated: viewerAuthenticated,
    }),
  ]);

  const viewPartners = partners.map((partner) => {
    if (isWithinPeriod(partner.period.start, partner.period.end)) {
      return partner;
    }
    return {
      ...partner,
      reservationLink: undefined,
      inquiryLink: undefined,
    };
  });
  return (
    <HomeView
      categories={categories}
      partners={viewPartners}
      viewerAuthenticated={viewerAuthenticated}
    />
  );
}
