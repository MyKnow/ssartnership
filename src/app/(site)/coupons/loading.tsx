import { CouponWalletPageSkeleton } from "@/components/loading/SitePageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function CouponWalletLoading() {
  return (
    <>
      <RouteLoadingStatus />
      <CouponWalletPageSkeleton />
    </>
  );
}
