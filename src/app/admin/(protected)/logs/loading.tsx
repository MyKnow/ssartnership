import { AdminLogsSkeleton } from '@/components/loading/AdminPageSkeletons';
import RouteLoadingStatus from '@/components/loading/RouteLoadingStatus';

export default function AdminLogsLoading() {
  return (
    <>
      <RouteLoadingStatus />
      <AdminLogsSkeleton />
    </>
  );
}
