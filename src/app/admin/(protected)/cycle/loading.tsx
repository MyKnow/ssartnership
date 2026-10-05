import { AdminCycleSkeleton } from "@/components/loading/AdminPageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function AdminCycleLoading() {
  return (
    <>
      <RouteLoadingStatus />
      <AdminCycleSkeleton />
    </>
  );
}
