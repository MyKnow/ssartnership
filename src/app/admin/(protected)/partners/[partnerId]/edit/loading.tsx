import {
  AdminRouteSkeleton,
  AdminPartnerDetailSkeletonContent,
} from "@/components/loading/AdminPageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function Loading() {
  return (
    <>
      <RouteLoadingStatus />
      <AdminRouteSkeleton title="제휴처 기본 정보 수정" backHref="/admin/partners" backLabel="제휴처">
        <AdminPartnerDetailSkeletonContent />
      </AdminRouteSkeleton>
    </>
  );
}
