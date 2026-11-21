import { AdminMembersSkeleton } from "@/components/loading/AdminPageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function AdminMembersLoading() {
  return (
    <>
      <RouteLoadingStatus />
      <AdminMembersSkeleton />
    </>
  );
}
