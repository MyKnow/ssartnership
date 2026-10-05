import { MemberEmailVerificationPageSkeleton } from "@/components/loading/SitePageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function CertificationEmailLoading() {
  return (
    <>
      <RouteLoadingStatus />
      <MemberEmailVerificationPageSkeleton />
    </>
  );
}
