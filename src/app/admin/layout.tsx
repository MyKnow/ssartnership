import { Suspense } from 'react';
import AdminNavigationTiming from '@/components/analytics/AdminNavigationTiming';
import AdminTaskTelemetry from '@/components/analytics/AdminTaskTelemetry';
import AdminWebVitals from '@/components/analytics/AdminWebVitals';
import RoutePageViewTracker from '@/components/analytics/RoutePageViewTracker';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Suspense fallback={null}>
        <RoutePageViewTracker area="admin" />
        <AdminWebVitals />
        <AdminNavigationTiming />
        <AdminTaskTelemetry />
      </Suspense>
      {children}
    </>
  );
}
