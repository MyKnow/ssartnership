import { NotificationsPageSkeleton } from "@/components/loading/SitePageSkeletons";
import RouteLoadingStatus from "@/components/loading/RouteLoadingStatus";

export default function NotificationsLoading() {
  return (
    <>
      <RouteLoadingStatus />
      <NotificationsPageSkeleton />
    </>
  );
}
