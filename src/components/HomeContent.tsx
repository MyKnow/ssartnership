import HomeView from "@/components/HomeView";
import CampusLandingSection from "@/components/CampusLandingSection";
import { getCampusSummaries } from "@/lib/campuses";
import { canViewPartnerDetails } from "@/lib/partner-visibility";
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
  const campusSummaries = getCampusSummaries(
    viewPartners.filter((partner) => canViewPartnerDetails(partner.visibility, false)),
  );

  return (
    <>
      <CampusLandingSection campuses={campusSummaries} />
      <HomeView
        categories={categories}
        partners={viewPartners}
        viewerAuthenticated={viewerAuthenticated}
      />
    </>
  );
}
