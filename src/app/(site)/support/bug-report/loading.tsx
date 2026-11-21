import { BugReportPageSkeleton } from "@/components/loading/SitePageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function BugReportLoading() {
  return (
    <>
      <RouteLoadingStatus />
      <BugReportPageSkeleton />
    </>
  );
}
