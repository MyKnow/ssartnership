import {
  AdminRouteSkeleton,
  AdminNotificationTemplatesSkeletonContent,
} from "@/components/loading/AdminPageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function Loading() {
  return (
    <>
      <RouteLoadingStatus />
      <AdminRouteSkeleton title="알림 템플릿" backHref="/admin" backLabel="관리 홈">
        <AdminNotificationTemplatesSkeletonContent />
      </AdminRouteSkeleton>
    </>
  );
}
