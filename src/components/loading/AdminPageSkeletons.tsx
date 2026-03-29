import AdminShell from "@/components/admin/AdminShell";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";

function SummaryCardSkeleton() {
  return (
    <Card className="h-full">
      <div className="flex h-full flex-col justify-between gap-6">
        <div className="grid gap-2">
          <Skeleton className="h-4 w-16 rounded-lg" />
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-4 w-full max-w-xs" />
          <Skeleton className="h-4 w-full max-w-sm" />
        </div>
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-5 w-24 rounded-lg" />
          <Skeleton className="h-12 w-12 rounded-full" />
        </div>
      </div>
    </Card>
  );
}

function MemberCardSkeleton() {
  return (
    <div className="rounded-3xl border border-border bg-surface-elevated p-5 shadow-md">
      <div className="grid gap-4 lg:grid-cols-[176px_minmax(0,1fr)]">
        <Skeleton className="aspect-square w-full rounded-3xl" />
        <div className="grid gap-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-4 w-44" />
        </div>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Skeleton className="h-4 w-20 rounded-lg" />
          <Skeleton className="h-12 w-full rounded-2xl" />
        </div>
        <div className="grid gap-2">
          <Skeleton className="h-4 w-20 rounded-lg" />
          <Skeleton className="h-12 w-full rounded-2xl" />
        </div>
      </div>
      <div className="mt-4 grid gap-2">
        <Skeleton className="h-4 w-24 rounded-lg" />
        <Skeleton className="h-12 w-full rounded-2xl" />
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Skeleton className="h-12 w-24 rounded-full" />
        <Skeleton className="h-12 w-28 rounded-full" />
      </div>
    </div>
  );
}

function CategoryRowSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-surface-elevated p-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(120px,0.75fr)_minmax(140px,0.9fr)_minmax(260px,2fr)_92px_auto_auto] lg:items-end">
        <div className="grid grid-cols-2 gap-4 lg:contents">
          <div className="grid gap-1.5">
            <Skeleton className="h-4 w-20 rounded-lg" />
            <Skeleton className="h-12 w-full rounded-2xl" />
          </div>
          <div className="grid gap-1.5">
            <Skeleton className="h-4 w-14 rounded-lg" />
            <Skeleton className="h-12 w-full rounded-2xl" />
          </div>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_92px] gap-4 lg:contents">
          <div className="grid gap-1.5">
            <Skeleton className="h-4 w-14 rounded-lg" />
            <Skeleton className="h-12 w-full rounded-2xl" />
          </div>
          <div className="grid gap-1.5">
            <Skeleton className="h-4 w-12 rounded-lg" />
            <Skeleton className="h-12 w-full rounded-2xl" />
          </div>
        </div>
        <div className="flex justify-end gap-2 lg:justify-start">
          <Skeleton className="h-12 w-20 rounded-full" />
          <Skeleton className="h-12 w-20 rounded-full" />
        </div>
      </div>
    </div>
  );
}

function PartnerEditorSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-8 w-20 rounded-full" />
      </div>
      <div className="mt-4 grid gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="grid gap-1">
            <Skeleton className="h-4 w-16 rounded-lg" />
            <Skeleton className="h-12 w-full rounded-2xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

function PushLogSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-surface-elevated p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="mt-2 h-4 w-full max-w-xl" />
          <Skeleton className="mt-2 h-4 w-full max-w-lg" />
        </div>
        <Skeleton className="h-8 w-24 rounded-full" />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Skeleton className="h-8 w-16 rounded-full" />
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="h-8 w-24 rounded-full" />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Skeleton className="h-12 w-24 rounded-full" />
        <Skeleton className="h-12 w-24 rounded-full" />
      </div>
    </div>
  );
}

export function AdminLoginSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <Card className="w-full max-w-md">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-4 w-20 rounded-lg" />
            <Skeleton className="mt-3 h-8 w-32" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-12 w-12 rounded-full" />
            <Skeleton className="h-12 w-12 rounded-full" />
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-4">
          <div className="grid gap-2">
            <Skeleton className="h-4 w-10 rounded-lg" />
            <Skeleton className="h-12 w-full rounded-2xl" />
          </div>
          <div className="grid gap-2">
            <Skeleton className="h-4 w-20 rounded-lg" />
            <Skeleton className="h-12 w-full rounded-2xl" />
          </div>
          <Skeleton className="mt-2 h-12 w-full rounded-full" />
        </div>
      </Card>
    </div>
  );
}

export function AdminOverviewSkeleton() {
  return (
    <AdminShell title="Admin 관리 홈">
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <SummaryCardSkeleton key={index} />
        ))}
      </div>
    </AdminShell>
  );
}

export function AdminMembersSkeleton() {
  return (
    <AdminShell title="회원 관리" backHref="/admin" backLabel="관리 홈">
      <Card>
        <Skeleton className="h-8 w-28" />
        <Skeleton className="mt-2 h-4 w-full max-w-lg" />
        <div className="mt-6 grid gap-4">
          <div className="rounded-2xl border border-border bg-surface-muted p-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
              <Skeleton className="h-12 w-full rounded-2xl" />
              <Skeleton className="h-12 w-full rounded-2xl" />
            </div>
          </div>
          <MemberCardSkeleton />
          <MemberCardSkeleton />
        </div>
      </Card>
    </AdminShell>
  );
}

export function AdminPartnersSkeleton() {
  return (
    <AdminShell title="업체 관리" backHref="/admin" backLabel="관리 홈">
      <section className="grid gap-6">
        <Card>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="mt-2 h-4 w-full max-w-md" />
          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(120px,0.75fr)_minmax(140px,0.9fr)_minmax(260px,2fr)_92px_auto] lg:items-end">
            <Skeleton className="h-12 w-full rounded-2xl" />
            <Skeleton className="h-12 w-full rounded-2xl" />
            <Skeleton className="h-12 w-full rounded-2xl" />
            <Skeleton className="h-12 w-full rounded-2xl" />
            <Skeleton className="h-12 w-24 rounded-full" />
          </div>
          <div className="mt-6 grid gap-3">
            <CategoryRowSkeleton />
            <CategoryRowSkeleton />
          </div>
        </Card>

        <Card>
          <Skeleton className="h-8 w-36" />
          <Skeleton className="mt-2 h-4 w-full max-w-md" />
          <div className="mt-6 grid gap-4">
            <PartnerEditorSkeleton />
            <PartnerEditorSkeleton />
          </div>
        </Card>
      </section>
    </AdminShell>
  );
}

export function AdminPushSkeleton() {
  return (
    <AdminShell title="푸시 알림 관리" backHref="/admin" backLabel="관리 홈">
      <Card>
        <Skeleton className="h-8 w-36" />
        <Skeleton className="mt-2 h-4 w-full max-w-lg" />

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="rounded-2xl border border-border bg-surface-muted px-4 py-4"
            >
              <Skeleton className="h-4 w-20 rounded-lg" />
              <Skeleton className="mt-3 h-8 w-24" />
              <Skeleton className="mt-2 h-4 w-full max-w-[12rem]" />
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <div className="rounded-2xl border border-border bg-surface-muted p-5">
            <Skeleton className="h-7 w-28" />
            <Skeleton className="mt-2 h-4 w-full max-w-md" />
            <div className="mt-5 grid gap-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="grid gap-1">
                  <Skeleton className="h-4 w-20 rounded-lg" />
                  <Skeleton className="h-12 w-full rounded-2xl" />
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-end">
              <Skeleton className="h-12 w-28 rounded-full" />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface-muted p-5">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="mt-2 h-4 w-full max-w-xs" />
            <div className="mt-5 grid gap-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full rounded-2xl" />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          <PushLogSkeleton />
          <PushLogSkeleton />
        </div>
      </Card>
    </AdminShell>
  );
}

export function AdminLogsSkeleton() {
  return (
    <AdminShell title="로그 조회" backHref="/admin" backLabel="관리 홈">
      <div className="grid gap-8">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="rounded-3xl border border-border bg-surface-elevated p-5 shadow-md"
            >
              <Skeleton className="h-4 w-20 rounded-lg" />
              <Skeleton className="mt-3 h-8 w-28" />
              <Skeleton className="mt-2 h-4 w-full max-w-[14rem]" />
              <Skeleton className="mt-2 h-4 w-full max-w-[11rem]" />
            </div>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <Card className="bg-surface-elevated shadow-md">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="mt-2 h-4 w-full max-w-md" />
            <div className="mt-5 grid gap-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-border bg-surface px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-4 w-14" />
                  </div>
                  <Skeleton className="mt-3 h-3 w-full rounded-full" />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid gap-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <Card key={index} className="bg-surface-elevated shadow-md">
                <Skeleton className="h-7 w-32" />
                <Skeleton className="mt-2 h-4 w-full max-w-xs" />
                <div className="mt-4 grid gap-2">
                  {Array.from({ length: 3 }).map((__, rowIndex) => (
                    <div
                      key={rowIndex}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3"
                    >
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-10" />
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section className="grid gap-4 rounded-3xl border border-border bg-surface-muted/50 p-5">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-4 w-full max-w-md" />

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,0.75fr))]">
            <Skeleton className="h-12 w-full rounded-2xl" />
            <Skeleton className="h-12 w-full rounded-2xl" />
            <Skeleton className="h-12 w-full rounded-2xl" />
            <Skeleton className="h-12 w-full rounded-2xl" />
            <Skeleton className="h-12 w-full rounded-2xl" />
            <Skeleton className="h-12 w-full rounded-2xl" />
          </div>

          <div className="grid gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Card key={index} className="bg-surface-elevated shadow-md">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Skeleton className="h-8 w-14 rounded-full" />
                      <Skeleton className="h-8 w-16 rounded-full" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                    <Skeleton className="mt-3 h-7 w-56" />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-28" />
                    </div>
                  </div>
                  <Skeleton className="h-8 w-20 rounded-full" />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Skeleton className="h-8 w-20 rounded-full" />
                  <Skeleton className="h-8 w-24 rounded-full" />
                  <Skeleton className="h-8 w-28 rounded-full" />
                </div>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
