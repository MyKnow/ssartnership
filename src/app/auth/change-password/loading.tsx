import { AuthChangePasswordPageSkeleton } from "@/components/loading/SitePageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function AuthChangePasswordLoading() {
  return (
    <>
      <RouteLoadingStatus />
      <AuthChangePasswordPageSkeleton />
    </>
  );
}
