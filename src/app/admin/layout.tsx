import { Suspense } from 'react';
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
      </Suspense>
      {children}
    </>
  );
}
