import { PartnerPasswordResetSkeleton } from "@/components/loading/RoutePageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function PartnerResetLoading() {
  return (
    <>
      <RouteLoadingStatus />
      <PartnerPasswordResetSkeleton />
    </>
  );
}
