import { AuthSignupPageSkeleton } from "@/components/loading/SitePageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function AuthSignupLoading() {
  return (
    <>
      <RouteLoadingStatus />
      <AuthSignupPageSkeleton />
    </>
  );
}
