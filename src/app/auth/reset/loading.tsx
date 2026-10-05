import { AuthResetPageSkeleton } from "@/components/loading/SitePageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function AuthResetLoading() {
  return (
    <>
      <RouteLoadingStatus />
      <AuthResetPageSkeleton />
    </>
  );
}
