import RoutePageViewTracker from '@/components/analytics/RoutePageViewTracker';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <RoutePageViewTracker area="admin" />
      {children}
    </>
  );
}
