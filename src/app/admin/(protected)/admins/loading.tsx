import {
  AdminRouteSkeleton,
  AdminAccountsSkeletonContent,
} from "@/components/loading/AdminPageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function Loading() {
  return (
    <>
      <RouteLoadingStatus />
      <AdminRouteSkeleton title="관리자 관리" backHref="/admin" backLabel="관리 홈">
        <AdminAccountsSkeletonContent />
      </AdminRouteSkeleton>
    </>
  );
}
