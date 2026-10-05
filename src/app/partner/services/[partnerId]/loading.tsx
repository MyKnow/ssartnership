import { PartnerServiceDetailSkeleton } from "@/components/loading/RoutePageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function PartnerServiceDetailLoading() {
  return (
    <>
      <RouteLoadingStatus />
      <PartnerServiceDetailSkeleton />
    </>
  );
}
