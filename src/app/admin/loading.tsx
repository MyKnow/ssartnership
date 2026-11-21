import { AdminOverviewSkeleton } from "@/components/loading/AdminPageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function AdminRootLoading() {
  return (
    <>
      <RouteLoadingStatus />
      <AdminOverviewSkeleton />
    </>
  );
}
