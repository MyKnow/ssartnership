import { PartnerBenefitUsePageSkeleton } from "@/components/loading/SitePageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function PartnerBenefitUseLoading() {
  return (
    <>
      <RouteLoadingStatus />
      <PartnerBenefitUsePageSkeleton />
    </>
  );
}
