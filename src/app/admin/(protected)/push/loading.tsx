import { AdminPushSkeleton } from "@/components/loading/AdminPageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function AdminPushLoading() {
  return (
    <>
      <RouteLoadingStatus />
      <AdminPushSkeleton />
    </>
  );
}
