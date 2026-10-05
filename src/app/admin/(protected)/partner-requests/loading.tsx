import { AdminPartnerRequestsSkeleton } from "@/components/loading/AdminPageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function AdminPartnerRequestsLoading() {
  return (
    <>
      <RouteLoadingStatus />
      <AdminPartnerRequestsSkeleton />
    </>
  );
}
