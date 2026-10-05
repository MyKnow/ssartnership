import { AdminPartnerCreateSkeleton } from "@/components/loading/AdminPageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function AdminPartnerCreateLoading() {
  return (
    <>
      <RouteLoadingStatus />
      <AdminPartnerCreateSkeleton />
    </>
  );
}
