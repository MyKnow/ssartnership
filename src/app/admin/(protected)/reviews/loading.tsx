import { AdminReviewsSkeleton } from "@/components/loading/AdminPageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function AdminReviewsLoading() {
  return (
    <>
      <RouteLoadingStatus />
      <AdminReviewsSkeleton />
    </>
  );
}
