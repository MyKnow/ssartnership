import {
  AdminRouteSkeleton,
  AdminCycleSkeletonContent,
} from "@/components/loading/AdminPageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function Loading() {
  return (
    <>
      <RouteLoadingStatus />
      <AdminRouteSkeleton title="전체 인증 카드 목업" backHref="/admin/cycle" backLabel="기수 관리">
        <AdminCycleSkeletonContent />
      </AdminRouteSkeleton>
    </>
  );
}
