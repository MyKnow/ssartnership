import { AdminPartnersSkeleton } from "@/components/loading/AdminPageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function AdminPartnersLoading() {
  return (
    <>
      <RouteLoadingStatus />
      <AdminPartnersSkeleton />
    </>
  );
}
