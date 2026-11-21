import {
  AdminRouteSkeleton,
  AdminProfilePhotosSkeletonContent,
} from "@/components/loading/AdminPageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function Loading() {
  return (
    <>
      <RouteLoadingStatus />
      <AdminRouteSkeleton title="프로필 사진">
        <AdminProfilePhotosSkeletonContent />
      </AdminRouteSkeleton>
    </>
  );
}
