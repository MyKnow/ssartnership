import { Suspense } from 'react';
import RoutePageViewTracker from '@/components/analytics/RoutePageViewTracker';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Suspense fallback={null}>
        <RoutePageViewTracker area="auth" />
      </Suspense>
      {children}
    </>
  );
}
