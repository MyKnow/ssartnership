import {
  AdminRouteSkeleton,
  AdminGraduateVerificationsSkeletonContent,
} from "@/components/loading/AdminPageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function Loading() {
  return (
    <>
      <RouteLoadingStatus />
      <AdminRouteSkeleton title="수료생 인증">
        <AdminGraduateVerificationsSkeletonContent />
      </AdminRouteSkeleton>
    </>
  );
}
