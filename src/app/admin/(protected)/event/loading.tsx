import {
  AdminRouteSkeleton,
  AdminEventSkeletonContent,
} from "@/components/loading/AdminPageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function Loading() {
  return (
    <>
      <RouteLoadingStatus />
      <AdminRouteSkeleton title="이벤트 관리" backHref="/admin" backLabel="관리 홈">
        <AdminEventSkeletonContent />
      </AdminRouteSkeleton>
    </>
  );
}
