import { CertificationVerifyPageSkeleton } from "@/components/loading/SitePageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function AppleWalletVerifyLoading() {
  return (
    <>
      <RouteLoadingStatus />
      <CertificationVerifyPageSkeleton />
    </>
  );
}
