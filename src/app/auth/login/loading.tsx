import { AuthLoginPageSkeleton } from "@/components/loading/SitePageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function AuthLoginLoading() {
  return (
    <>
      <RouteLoadingStatus />
      <AuthLoginPageSkeleton />
    </>
  );
}
