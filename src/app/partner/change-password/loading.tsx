import { PartnerPasswordChangeSkeleton } from "@/components/loading/RoutePageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function PartnerChangePasswordLoading() {
  return (
    <>
      <RouteLoadingStatus />
      <PartnerPasswordChangeSkeleton />
    </>
  );
}
