import { HomePageSkeleton } from "@/components/loading/SitePageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function SiteLoading() {
  return (
    <>
      <RouteLoadingStatus />
      <HomePageSkeleton />
    </>
  );
}
