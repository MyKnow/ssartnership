import { AdminLoginSkeleton } from "@/components/loading/AdminPageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function AdminLoginLoading() {
  return (
    <>
      <RouteLoadingStatus />
      <AdminLoginSkeleton />
    </>
  );
}
