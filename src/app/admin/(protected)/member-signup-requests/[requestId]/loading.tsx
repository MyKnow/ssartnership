import {
  AdminRouteSkeleton,
  AdminMemberSignupRequestDetailSkeletonContent,
} from "@/components/loading/AdminPageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function Loading() {
  return (
    <>
      <RouteLoadingStatus />
      <AdminRouteSkeleton title="가입 승인 검토">
        <AdminMemberSignupRequestDetailSkeletonContent />
      </AdminRouteSkeleton>
    </>
  );
}
