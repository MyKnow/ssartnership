import { AdminProtectedSkeleton } from "@/components/loading/AdminPageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function AdminLoading() {
  return (
    <>
      <RouteLoadingStatus />
      <AdminProtectedSkeleton />
    </>
  );
}
