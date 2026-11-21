import { AdminGlobalSearchSkeleton } from "@/components/loading/AdminPageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function AdminGlobalSearchLoading() {
  return (
    <>
      <RouteLoadingStatus />
      <AdminGlobalSearchSkeleton />
    </>
  );
}
