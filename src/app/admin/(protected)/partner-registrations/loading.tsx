import {
  AdminRouteSkeleton,
  AdminPartnerRegistrationsSkeletonContent,
} from "@/components/loading/AdminPageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function Loading() {
  return (
    <>
      <RouteLoadingStatus />
      <AdminRouteSkeleton title="제휴 등록 신청" backHref="/admin/partners" backLabel="제휴처">
        <AdminPartnerRegistrationsSkeletonContent />
      </AdminRouteSkeleton>
    </>
  );
}
