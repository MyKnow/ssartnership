import { Suspense } from "react";
import RoutePageViewTracker from "@/components/analytics/RoutePageViewTracker";

export default function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Suspense fallback={null}>
        <RoutePageViewTracker area="partner" />
      </Suspense>
      {children}
    </>
  );
}
