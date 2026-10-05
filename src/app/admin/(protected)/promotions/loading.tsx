import {
  AdminRouteSkeleton,
  AdminAdvertisementSkeletonContent,
} from "@/components/loading/AdminPageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function Loading() {
  return (
    <>
      <RouteLoadingStatus />
      <AdminRouteSkeleton title="홈 광고 관리" backHref="/admin" backLabel="관리 홈">
        <AdminAdvertisementSkeletonContent />
      </AdminRouteSkeleton>
    </>
  );
}
