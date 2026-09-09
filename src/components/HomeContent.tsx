import HomeView from "@/components/HomeView";
import HomeDirectoryError from "@/components/home-view/HomeDirectoryError";
import {
  loadHomePartnerDirectoryState,
  type HomePartnerDirectoryLoadState,
} from "@/lib/home-partner-directory";
import type { PartnerAudienceKey } from "@/lib/partner-audience";

export default async function HomeContent({
  viewerAuthenticated,
  currentUserId,
  viewerAudience,
  directoryPromise,
}: {
  viewerAuthenticated: boolean;
  currentUserId: string | null;
  viewerAudience?: PartnerAudienceKey | null;
  directoryPromise?: Promise<HomePartnerDirectoryLoadState>;
}) {
  const directoryState = await (
    directoryPromise ??
    loadHomePartnerDirectoryState({
      viewerAuthenticated,
      currentUserId,
      viewerAudience,
    })
  );

  if (directoryState.status === "unavailable") {
    return (
      <div className="min-w-0">
        <HomeDirectoryError />
      </div>
    );
  }

  const { directory } = directoryState;

  return (
    <div className="min-w-0">
      <HomeView
        categories={directory.categories}
        partners={directory.partners}
        viewerAuthenticated={viewerAuthenticated}
        currentUserId={currentUserId}
        partnerPopularityById={directory.partnerState.partnerPopularityById}
        partnerFavoriteStateById={directory.partnerState.partnerFavoriteStateById}
        loadedFavoritePartnerIds={directory.partnerState.loadedFavoritePartnerIds}
      />
    </div>
  );
}
