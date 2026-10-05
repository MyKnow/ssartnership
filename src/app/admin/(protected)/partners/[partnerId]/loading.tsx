import { AdminPartnerDetailSkeleton } from "@/components/loading/AdminPageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function AdminPartnerDetailLoading() {
  return (
    <>
      <RouteLoadingStatus />
      <AdminPartnerDetailSkeleton />
    </>
  );
}
