import HomeView from "@/components/HomeView";
import {
  getHomePartnerState,
  HOME_PARTNER_STATE_BATCH_LIMIT,
} from "@/lib/home-partner-state";
import { partnerRepository } from "@/lib/repositories";
import { isWithinPeriod } from "@/lib/partner-utils";
import type { PartnerAudienceKey } from "@/lib/partner-audience";

export default async function HomeContent({
  viewerAuthenticated,
  currentUserId,
  viewerAudience,
}: {
  viewerAuthenticated: boolean;
  currentUserId: string | null;
  viewerAudience?: PartnerAudienceKey | null;
}) {
  const [categories, partners] = await Promise.all([
    partnerRepository.getCategories(),
    partnerRepository.getPartners({
      authenticated: viewerAuthenticated,
      viewerAudience,
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
  const initialPartnerStateIds = viewPartners
    .slice(0, HOME_PARTNER_STATE_BATCH_LIMIT)
    .map((partner) => partner.id);
  const partnerState = await getHomePartnerState({
    partnerIds: initialPartnerStateIds,
    currentUserId,
  });

  return (
    <section id="partner-explore" className="scroll-mt-24">
      <HomeView
        categories={categories}
        partners={viewPartners}
        viewerAuthenticated={viewerAuthenticated}
        currentUserId={currentUserId}
        partnerPopularityById={partnerState.partnerPopularityById}
        partnerFavoriteStateById={partnerState.partnerFavoriteStateById}
        loadedPartnerStateIds={partnerState.loadedPartnerIds}
      />
    </section>
  );
}
