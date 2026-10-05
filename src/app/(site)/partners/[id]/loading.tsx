import { PublicPartnerDetailSkeleton } from "@/components/loading/RoutePageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function PartnerDetailLoading() {
  return (
    <>
      <RouteLoadingStatus />
      <PublicPartnerDetailSkeleton />
    </>
  );
}
