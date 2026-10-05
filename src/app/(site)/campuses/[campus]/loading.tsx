import { CampusPageSkeleton } from "@/components/loading/SitePageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function CampusLoading() {
  return (
    <>
      <RouteLoadingStatus />
      <CampusPageSkeleton />
    </>
  );
}
