import {
  AdminRouteSkeleton,
  AdminMemberDetailSkeletonContent,
} from "@/components/loading/AdminPageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function Loading() {
  return (
    <>
      <RouteLoadingStatus />
      <AdminRouteSkeleton title="회원 상세" backHref="/admin/members" backLabel="회원 관리">
        <AdminMemberDetailSkeletonContent />
      </AdminRouteSkeleton>
    </>
  );
}
