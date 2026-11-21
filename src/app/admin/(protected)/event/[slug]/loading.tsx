import {
  AdminRouteSkeleton,
  AdminEventDetailSkeletonContent,
} from "@/components/loading/AdminPageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function Loading() {
  return (
    <>
      <RouteLoadingStatus />
      <AdminRouteSkeleton title="이벤트 상세" backHref="/admin/event" backLabel="이벤트 목록">
        <AdminEventDetailSkeletonContent />
      </AdminRouteSkeleton>
    </>
  );
}
