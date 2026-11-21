import { CertificationPageSkeleton } from "@/components/loading/SitePageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function CertificationLoading() {
  return (
    <>
      <RouteLoadingStatus />
      <CertificationPageSkeleton />
    </>
  );
}
