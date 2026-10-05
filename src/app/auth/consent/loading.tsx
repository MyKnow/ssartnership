import { AuthConsentPageSkeleton } from "@/components/loading/SitePageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function AuthConsentLoading() {
  return (
    <>
      <RouteLoadingStatus />
      <AuthConsentPageSkeleton />
    </>
  );
}
