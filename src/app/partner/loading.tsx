import { PartnerPortalRouteSkeleton } from "@/components/loading/RoutePageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function PartnerLoading() {
  return (
    <>
      <RouteLoadingStatus />
      <PartnerPortalRouteSkeleton />
    </>
  );
}
