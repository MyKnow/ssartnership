import { AdminCategoriesSkeleton } from "@/components/loading/AdminPageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function AdminCategoriesLoading() {
  return (
    <>
      <RouteLoadingStatus />
      <AdminCategoriesSkeleton />
    </>
  );
}
