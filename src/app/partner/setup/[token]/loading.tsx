import { PartnerSetupPageSkeleton } from "@/components/loading/RoutePageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function PartnerSetupTokenLoading() {
  return (
    <>
      <RouteLoadingStatus />
      <PartnerSetupPageSkeleton />
    </>
  );
}
