import { GlobalRouteSkeleton } from "@/components/loading/RoutePageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function RootLoading() {
  return (
    <>
      <RouteLoadingStatus />
      <GlobalRouteSkeleton />
    </>
  );
}
