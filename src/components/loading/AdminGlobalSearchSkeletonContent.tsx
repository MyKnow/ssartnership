import Skeleton from "@/components/ui/Skeleton";
import Surface from "@/components/ui/Surface";

function SearchResultRowsSkeleton() {
  return (
    <div className="grid min-w-0 gap-3">
      {Array.from({ length: 2 }).map((_, index) => (
        <Surface
          key={index}
          level="inset"
          padding="md"
          className="grid min-w-0 gap-4 sm:grid-cols-[3.5rem_minmax(0,1fr)_auto] sm:items-center"
        >
          <Skeleton className="h-14 w-14 rounded-2xl" />
          <div className="grid min-w-0 gap-2">
            <Skeleton className="h-5 w-48 max-w-full" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </div>
          <Skeleton className="h-11 w-11 rounded-2xl" />
        </Surface>
      ))}
    </div>
  );
}

export function AdminGlobalSearchSkeletonContent({
  showHeader = true,
}: {
  showHeader?: boolean;
} = {}) {
  return (
    <div className="grid min-w-0 gap-6" aria-busy="true">
      {showHeader ? (
        <div className="grid min-w-0 gap-3 border-b border-border/70 pb-6">
          <Skeleton className="h-4 w-24 rounded-lg" />
          <Skeleton className="h-9 w-48 max-w-full" />
          <Skeleton className="h-4 w-full max-w-2xl" />
        </div>
      ) : null}
      <Surface level="default" padding="lg" className="grid min-w-0 gap-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-full max-w-md" />
        <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <Skeleton className="h-12 w-full rounded-2xl" />
          <Skeleton className="h-12 w-20 rounded-2xl" />
        </div>
      </Surface>
      <div className="grid min-w-0 gap-4">
        <Skeleton className="h-6 w-16" />
        <SearchResultRowsSkeleton />
      </div>
    </div>
  );
}
