import {
  AdminRouteSkeleton,
  AdminTaskInboxSkeletonContent,
} from "@/components/loading/AdminPageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function Loading() {
  return (
    <>
      <RouteLoadingStatus />
      <AdminRouteSkeleton title="작업함" backHref="/admin" backLabel="관리 홈">
        <AdminTaskInboxSkeletonContent />
      </AdminRouteSkeleton>
    </>
  );
}
