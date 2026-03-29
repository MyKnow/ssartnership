import { Suspense } from 'react';
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
      </Suspense>
      {children}
    </>
  );
}
