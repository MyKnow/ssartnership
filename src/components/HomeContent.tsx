import HomeView from "@/components/HomeView";
import { loadHomePartnerDirectory } from "@/lib/home-partner-directory";
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
  const directory = await loadHomePartnerDirectory({
    viewerAuthenticated,
    currentUserId,
    viewerAudience,
  });

  return (
    <div className="min-w-0">
      <HomeView
        categories={directory.categories}
        partners={directory.partners}
        viewerAuthenticated={viewerAuthenticated}
        currentUserId={currentUserId}
        partnerPopularityById={directory.partnerState.partnerPopularityById}
        partnerFavoriteStateById={directory.partnerState.partnerFavoriteStateById}
        loadedPartnerStateIds={directory.partnerState.loadedPartnerIds}
      />
    </div>
  );
}
