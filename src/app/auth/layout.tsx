import RoutePageViewTracker from '@/components/analytics/RoutePageViewTracker';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <RoutePageViewTracker area="auth" />
      {children}
    </>
  );
}
