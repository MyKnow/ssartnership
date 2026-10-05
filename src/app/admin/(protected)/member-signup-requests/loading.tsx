import {
  AdminRouteSkeleton,
  AdminMemberSignupRequestsSkeletonContent,
} from "@/components/loading/AdminPageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function Loading() {
  return (
    <>
      <RouteLoadingStatus />
      <AdminRouteSkeleton title="가입 승인">
        <AdminMemberSignupRequestsSkeletonContent />
      </AdminRouteSkeleton>
    </>
  );
}
