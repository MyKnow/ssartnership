import { PartnerLoginSkeleton } from "@/components/loading/RoutePageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function PartnerLoginLoading() {
  return (
    <>
      <RouteLoadingStatus />
      <PartnerLoginSkeleton />
    </>
  );
}
