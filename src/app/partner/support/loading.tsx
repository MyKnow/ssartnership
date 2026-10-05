import { PartnerSupportSkeleton } from "@/components/loading/RoutePageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function PartnerSupportLoading() {
  return (
    <>
      <RouteLoadingStatus />
      <PartnerSupportSkeleton />
    </>
  );
}
