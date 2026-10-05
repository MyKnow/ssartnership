import { AdminCompaniesSkeleton } from "@/components/loading/AdminPageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function AdminCompaniesLoading() {
  return (
    <>
      <RouteLoadingStatus />
      <AdminCompaniesSkeleton />
    </>
  );
}
