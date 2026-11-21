import { LegalRouteSkeleton } from "@/components/loading/RoutePageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function LegalLoading() {
  return (
    <>
      <RouteLoadingStatus />
      <LegalRouteSkeleton />
    </>
  );
}
