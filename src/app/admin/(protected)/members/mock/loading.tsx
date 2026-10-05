import { AdminMembersSkeleton } from "@/components/loading/AdminPageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function AdminMemberMockLoading() {
  return (
    <>
      <RouteLoadingStatus />
      <AdminMembersSkeleton />
    </>
  );
}
