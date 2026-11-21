import { SuggestPageSkeleton } from "@/components/loading/SitePageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function SuggestLoading() {
  return (
    <>
      <RouteLoadingStatus />
      <SuggestPageSkeleton />
    </>
  );
}
