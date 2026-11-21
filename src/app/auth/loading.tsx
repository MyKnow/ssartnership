import { AuthPageSkeleton } from "@/components/loading/SitePageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function AuthLoading() {
  return (
    <>
      <RouteLoadingStatus />
      <AuthPageSkeleton />
    </>
  );
}
