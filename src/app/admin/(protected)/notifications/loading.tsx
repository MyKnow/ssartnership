import {
  AdminRouteSkeleton,
  AdminNotificationsSkeletonContent,
} from "@/components/loading/AdminPageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function Loading() {
  return (
    <>
      <RouteLoadingStatus />
      <AdminRouteSkeleton title="내 알림" backHref="/admin" backLabel="관리 홈">
        <AdminNotificationsSkeletonContent />
      </AdminRouteSkeleton>
    </>
  );
}
