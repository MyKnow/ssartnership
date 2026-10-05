import { PartnerSetupIndexSkeleton } from "@/components/loading/RoutePageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function PartnerSetupLoading() {
  return (
    <>
      <RouteLoadingStatus />
      <PartnerSetupIndexSkeleton />
    </>
  );
}
