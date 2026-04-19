import AdminShell from "@/components/admin/AdminShell";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";

function ShellHeaderSkeleton({
  titleWidth = "w-44",
  descriptionWidth = "max-w-2xl",
}: {
  titleWidth?: string;
  descriptionWidth?: string;
}) {
  return (
    <div className="grid gap-3">
      <Skeleton className="h-4 w-24 rounded-lg" />
      <Skeleton className={`h-8 ${titleWidth}`} />
      <Skeleton className={`h-4 w-full ${descriptionWidth}`} />
      <Skeleton className="h-4 w-full max-w-xl" />
    </div>
  );
}

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

function MetricTileSkeleton() {
  return (
    <div className="rounded-2xl border border-border/70 bg-surface-muted/70 p-4">
      <Skeleton className="h-4 w-20 rounded-lg" />
      <Skeleton className="mt-3 h-7 w-28" />
      <Skeleton className="mt-2 h-4 w-full max-w-[14rem]" />
    </div>
  );
}

function MetricRowSkeleton({ count }: { count: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <MetricTileSkeleton key={index} />
      ))}
    </div>
  );
}

function FilterBarSkeleton({
  fields = 4,
}: {
  fields?: number;
}) {
  return (
    <Card tone="muted" padding="md" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Skeleton className="h-4 w-24 rounded-lg" />
          <Skeleton className="h-4 w-full max-w-lg" />
        </div>
        <Skeleton className="h-12 w-28 rounded-full" />
      </div>
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        {Array.from({ length: fields }).map((_, index) => (
          <div key={index} className="grid min-w-[10rem] gap-1">
            <Skeleton className="h-4 w-14 rounded-lg" />
            <Skeleton className="h-12 w-full rounded-2xl" />
          </div>
        ))}
      </div>
    </Card>
  );
}

function RowCardSkeleton({
  chipCount = 3,
  metricCount = 3,
}: {
  chipCount?: number;
  metricCount?: number;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface-inset px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {Array.from({ length: chipCount }).map((_, index) => (
              <Skeleton key={index} className="h-7 w-20 rounded-full" />
            ))}
          </div>
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>
        <Skeleton className="h-8 w-20 rounded-full" />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: metricCount }).map((_, index) => (
          <MetricTileSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}

function ListRowSkeleton({
  metricCount = 6,
}: {
  metricCount?: number;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface-inset px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-7 w-14 rounded-full" />
            <Skeleton className="h-7 w-16 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>
        <Skeleton className="h-12 w-24 rounded-full" />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {Array.from({ length: metricCount }).map((_, index) => (
          <MetricTileSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}

function ReviewCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-surface-inset px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
        <Skeleton className="h-7 w-20 rounded-full" />
      </div>
      <Skeleton className="mt-3 h-4 w-full max-w-2xl" />
      <Skeleton className="mt-2 h-4 w-full max-w-xl" />
    </div>
  );
}

function TextCardSkeleton({
  titleWidth = "w-32",
  descriptionWidth = "max-w-lg",
  lines = 3,
}: {
  titleWidth?: string;
  descriptionWidth?: string;
  lines?: number;
}) {
  return (
    <Card tone="elevated" className="space-y-4">
      <div className="grid gap-2">
        <Skeleton className={`h-6 ${titleWidth}`} />
        <Skeleton className={`h-4 w-full ${descriptionWidth}`} />
      </div>
      <div className="grid gap-2">
        {Array.from({ length: lines }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full rounded-2xl" />
        ))}
      </div>
    </Card>
  );
}

export function AdminLoginSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <Card tone="elevated" className="w-full max-w-md space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div className="grid gap-2">
            <Skeleton className="h-4 w-20 rounded-lg" />
            <Skeleton className="h-8 w-32" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-12 w-12 rounded-full" />
            <Skeleton className="h-12 w-12 rounded-full" />
          </div>
        </div>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Skeleton className="h-4 w-10 rounded-lg" />
            <Skeleton className="h-12 w-full rounded-2xl" />
          </div>
          <div className="grid gap-2">
            <Skeleton className="h-4 w-20 rounded-lg" />
            <Skeleton className="h-12 w-full rounded-2xl" />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Skeleton className="h-12 w-28 rounded-full" />
            <Skeleton className="h-12 w-32 rounded-full" />
          </div>
        </div>
      </Card>
    </div>
  );
}

export function AdminOverviewSkeleton() {
  return (
    <AdminShell title="Admin 관리 홈">
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 8 }).map((_, index) => (
          <SummaryCardSkeleton key={index} />
        ))}
      </div>
    </AdminShell>
  );
}

export function AdminProtectedSkeleton() {
  return (
    <AdminShell title="관리 화면" backHref="/admin" backLabel="관리 홈">
      <div className="grid gap-6">
        <ShellHeaderSkeleton titleWidth="w-48" descriptionWidth="max-w-2xl" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <SummaryCardSkeleton key={index} />
          ))}
        </div>
        <Card tone="elevated" className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-full max-w-xl" />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <RowCardSkeleton key={index} metricCount={2} chipCount={2} />
            ))}
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}

export function AdminMembersSkeleton() {
  return (
    <AdminShell title="회원 관리" backHref="/admin" backLabel="관리 홈">
      <div className="grid gap-6">
        <ShellHeaderSkeleton titleWidth="w-40" descriptionWidth="max-w-2xl" />

        <Card tone="elevated" className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-4 w-full max-w-lg" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-11 w-28 rounded-full" />
              <Skeleton className="h-11 w-32 rounded-full" />
            </div>
          </div>
          <Skeleton className="h-12 w-full rounded-2xl" />
          <Skeleton className="h-12 w-full rounded-2xl" />
        </Card>

        <Card tone="elevated" className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-4 w-full max-w-xl" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-12 w-28 rounded-full" />
              <Skeleton className="h-12 w-28 rounded-full" />
            </div>
          </div>

          <div className="grid gap-4 rounded-3xl border border-border bg-surface-muted/40 p-4">
            <div className="grid gap-3 lg:grid-cols-[160px_minmax(0,1fr)] lg:items-end">
              <Skeleton className="h-12 w-full rounded-2xl" />
              <div className="grid gap-2">
                <Skeleton className="h-4 w-40 rounded-lg" />
                <Skeleton className="h-4 w-full max-w-2xl" />
              </div>
            </div>
            <Skeleton className="h-32 w-full rounded-2xl" />
            <div className="flex flex-wrap justify-between gap-3">
              <Skeleton className="h-4 w-full max-w-sm" />
              <Skeleton className="h-12 w-32 rounded-full" />
            </div>
          </div>
        </Card>

        <Card tone="elevated" className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-4 w-full max-w-xl" />
            </div>
            <Skeleton className="h-12 w-36 rounded-full" />
          </div>
          <FilterBarSkeleton fields={12} />
          <div className="grid gap-4">
            {Array.from({ length: 2 }).map((_, index) => (
              <ListRowSkeleton key={index} />
            ))}
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}

export function AdminPartnersSkeleton() {
  return (
    <AdminShell title="브랜드 관리" backHref="/admin" backLabel="관리 홈">
      <div className="grid gap-6">
        <ShellHeaderSkeleton titleWidth="w-48" descriptionWidth="max-w-2xl" />

        <Card tone="elevated" className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-full max-w-xl" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-12 w-28 rounded-full" />
              <Skeleton className="h-12 w-28 rounded-full" />
            </div>
          </div>
          <div className="grid gap-4">
            {Array.from({ length: 2 }).map((_, index) => (
              <RowCardSkeleton key={index} metricCount={3} chipCount={3} />
            ))}
          </div>
        </Card>

        <Card tone="elevated" className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-4 w-full max-w-xl" />
            </div>
            <Skeleton className="h-8 w-20 rounded-full" />
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(120px,0.75fr)_minmax(140px,0.9fr)_minmax(260px,2fr)_92px_auto] lg:items-end">
            <Skeleton className="h-12 w-full rounded-2xl" />
            <Skeleton className="h-12 w-full rounded-2xl" />
            <Skeleton className="h-12 w-full rounded-2xl" />
            <Skeleton className="h-12 w-full rounded-2xl" />
            <Skeleton className="h-12 w-24 rounded-full" />
          </div>
          <div className="grid gap-3">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="rounded-2xl border border-border bg-surface-muted/40 p-4">
                <div className="grid gap-4 lg:grid-cols-[minmax(120px,0.75fr)_minmax(140px,0.9fr)_minmax(260px,2fr)_92px_auto_auto] lg:items-end">
                  <div className="grid gap-2">
                    <Skeleton className="h-4 w-20 rounded-lg" />
                    <Skeleton className="h-12 w-full rounded-2xl" />
                  </div>
                  <div className="grid gap-2">
                    <Skeleton className="h-4 w-14 rounded-lg" />
                    <Skeleton className="h-12 w-full rounded-2xl" />
                  </div>
                  <div className="grid gap-2">
                    <Skeleton className="h-4 w-16 rounded-lg" />
                    <Skeleton className="h-12 w-full rounded-2xl" />
                  </div>
                  <div className="grid gap-2">
                    <Skeleton className="h-4 w-12 rounded-lg" />
                    <Skeleton className="h-12 w-full rounded-2xl" />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Skeleton className="h-12 w-20 rounded-full" />
                    <Skeleton className="h-12 w-20 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card tone="elevated" className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-full max-w-xl" />
            </div>
            <Skeleton className="h-8 w-20 rounded-full" />
          </div>
          <div className="grid gap-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <ListRowSkeleton key={index} metricCount={6} />
            ))}
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}

export function AdminPartnerDetailSkeleton() {
  return (
    <AdminShell title="브랜드 상세" backHref="/admin/partners" backLabel="브랜드 관리">
      <div className="grid gap-6">
        <ShellHeaderSkeleton titleWidth="w-48" descriptionWidth="max-w-2xl" />
        <Card tone="elevated" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-7 w-20 rounded-full" />
            <Skeleton className="h-7 w-20 rounded-full" />
            <Skeleton className="h-7 w-20 rounded-full" />
          </div>
          <MetricRowSkeleton count={8} />
        </Card>
        <Card tone="elevated" className="space-y-4">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-full max-w-xl" />
          <Skeleton className="h-72 w-full rounded-[2rem]" />
        </Card>
        <Card tone="elevated" className="space-y-4">
          <Skeleton className="h-6 w-28" />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
            <div className="space-y-4">
              <TextCardSkeleton titleWidth="w-28" descriptionWidth="max-w-xl" lines={4} />
              <TextCardSkeleton titleWidth="w-32" descriptionWidth="max-w-xl" lines={3} />
            </div>
            <TextCardSkeleton titleWidth="w-28" descriptionWidth="max-w-md" lines={5} />
          </div>
        </Card>
        <Card tone="elevated" className="space-y-4">
          <Skeleton className="h-6 w-20" />
          <div className="grid gap-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <ReviewCardSkeleton key={index} />
            ))}
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}

export function AdminPartnerCreateSkeleton() {
  return (
    <AdminShell title="브랜드 추가" backHref="/admin/partners" backLabel="브랜드 관리">
      <div className="grid gap-6">
        <ShellHeaderSkeleton titleWidth="w-44" descriptionWidth="max-w-2xl" />
        <Card tone="elevated" className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-4 w-full max-w-xl" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-8 w-20 rounded-full" />
              <Skeleton className="h-8 w-20 rounded-full" />
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="grid gap-4">
              <div className="grid gap-2 rounded-2xl border border-border bg-surface-muted/40 p-4">
                <Skeleton className="h-4 w-20 rounded-lg" />
                <Skeleton className="h-12 w-full rounded-2xl" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2 rounded-2xl border border-border bg-surface-muted/40 p-4">
                  <Skeleton className="h-4 w-14 rounded-lg" />
                  <Skeleton className="h-12 w-full rounded-2xl" />
                </div>
                <div className="grid gap-2 rounded-2xl border border-border bg-surface-muted/40 p-4">
                  <Skeleton className="h-4 w-16 rounded-lg" />
                  <Skeleton className="h-12 w-full rounded-2xl" />
                </div>
              </div>
              <div className="grid gap-2 rounded-2xl border border-border bg-surface-muted/40 p-4">
                <Skeleton className="h-4 w-24 rounded-lg" />
                <Skeleton className="h-32 w-full rounded-3xl" />
              </div>
            </div>
            <div className="grid gap-4">
              <div className="grid gap-2 rounded-2xl border border-border bg-surface-muted/40 p-4">
                <Skeleton className="h-4 w-24 rounded-lg" />
                <Skeleton className="h-12 w-full rounded-2xl" />
                <Skeleton className="h-12 w-full rounded-2xl" />
              </div>
              <div className="grid gap-2 rounded-2xl border border-border bg-surface-muted/40 p-4">
                <Skeleton className="h-4 w-20 rounded-lg" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Skeleton className="h-20 w-full rounded-2xl" />
                  <Skeleton className="h-20 w-full rounded-2xl" />
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Skeleton className="h-12 w-28 rounded-full" />
                <Skeleton className="h-12 w-28 rounded-full" />
              </div>
            </div>
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}

export function AdminCompaniesSkeleton() {
  return (
    <AdminShell title="협력사 관리" backHref="/admin" backLabel="관리 홈">
      <div className="grid gap-6">
        <ShellHeaderSkeleton titleWidth="w-56" descriptionWidth="max-w-2xl" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <SummaryCardSkeleton key={index} />
          ))}
        </div>
        <Card tone="elevated" className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-full max-w-xl" />
          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <TextCardSkeleton titleWidth="w-32" descriptionWidth="max-w-xl" lines={2} />
            <TextCardSkeleton titleWidth="w-28" descriptionWidth="max-w-md" lines={3} />
          </div>
        </Card>
        <Card tone="elevated" className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-full max-w-xl" />
          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <TextCardSkeleton titleWidth="w-32" descriptionWidth="max-w-xl" lines={2} />
            <TextCardSkeleton titleWidth="w-28" descriptionWidth="max-w-md" lines={3} />
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}

export function AdminCycleSkeleton() {
  return (
    <AdminShell title="기수 관리" backHref="/admin" backLabel="관리 홈">
      <div className="grid gap-6">
        <ShellHeaderSkeleton titleWidth="w-48" descriptionWidth="max-w-2xl" />
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card tone="elevated" className="space-y-5">
            <Skeleton className="h-6 w-32" />
            <div className="grid gap-4 sm:grid-cols-2">
              <SummaryCardSkeleton />
              <SummaryCardSkeleton />
            </div>
            <Card tone="muted" padding="md" className="space-y-4">
              <Skeleton className="h-5 w-28" />
              <div className="grid gap-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="rounded-2xl border border-border bg-surface-muted/40 p-4">
                    <Skeleton className="h-4 w-24 rounded-lg" />
                    <Skeleton className="mt-2 h-6 w-36" />
                  </div>
                ))}
              </div>
            </Card>
          </Card>

          <Card tone="elevated" className="space-y-5">
            <Skeleton className="h-6 w-28" />
            <div className="grid gap-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="grid gap-2">
                  <Skeleton className="h-4 w-20 rounded-lg" />
                  <Skeleton className="h-12 w-full rounded-2xl" />
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-12 w-28 rounded-full" />
              <Skeleton className="h-12 w-28 rounded-full" />
              <Skeleton className="h-12 w-28 rounded-full" />
            </div>
          </Card>
        </div>
      </div>
    </AdminShell>
  );
}

export function AdminReviewsSkeleton() {
  return (
    <AdminShell title="리뷰 관리" backHref="/admin" backLabel="관리 홈">
      <div className="grid gap-6">
        <ShellHeaderSkeleton titleWidth="w-40" descriptionWidth="max-w-2xl" />
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <SummaryCardSkeleton key={index} />
          ))}
        </div>
        <FilterBarSkeleton fields={4} />
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <ReviewCardSkeleton key={index} />
          ))}
        </div>
      </div>
    </AdminShell>
  );
}

export function AdminStyleGuideSkeleton() {
  return (
    <AdminShell title="UI 스타일 가이드" backHref="/admin" backLabel="관리 홈">
      <div className="grid gap-6">
        <ShellHeaderSkeleton titleWidth="w-56" descriptionWidth="max-w-2xl" />
        <Card tone="elevated" className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-10 w-24 rounded-full" />
            <Skeleton className="h-10 w-24 rounded-full" />
            <Skeleton className="h-10 w-24 rounded-full" />
            <Skeleton className="h-10 w-24 rounded-full" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="rounded-2xl border border-border bg-surface-inset/70 p-4">
                <Skeleton className="h-4 w-20 rounded-lg" />
                <Skeleton className="mt-3 h-8 w-32" />
                <Skeleton className="mt-2 h-4 w-full max-w-md" />
              </div>
            ))}
          </div>
        </Card>
        <Card tone="elevated" className="space-y-4">
          <Skeleton className="h-6 w-40" />
          <div className="grid gap-3 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="rounded-2xl border border-border bg-surface-inset/70 p-4">
                <Skeleton className="h-4 w-24 rounded-lg" />
                <Skeleton className="mt-3 h-12 w-full rounded-2xl" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}

export function AdminPushSkeleton() {
  return (
        <AdminShell title="통합 알림 운영" backHref="/admin" backLabel="관리 홈">
      <div className="grid gap-6">
        <ShellHeaderSkeleton titleWidth="w-48" descriptionWidth="max-w-2xl" />
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <div
              key={index}
              className="grid gap-2 rounded-2xl border border-border bg-surface-inset px-4 py-3"
            >
              <Skeleton className="h-4 w-20 rounded-lg" />
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-4 w-full max-w-sm" />
            </div>
          ))}
        </div>
        <Card tone="elevated" className="space-y-5">
          <FilterBarSkeleton fields={4} />

          <Card tone="muted" padding="md" className="space-y-4">
            <Skeleton className="h-6 w-32" />
            <div className="grid gap-3 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-border bg-surface-inset px-4 py-3"
                >
                  <Skeleton className="h-4 w-20 rounded-lg" />
                  <Skeleton className="mt-2 h-8 w-24" />
                  <Skeleton className="mt-2 h-4 w-full max-w-[12rem]" />
                </div>
              ))}
            </div>
          </Card>

          <div className="grid gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="rounded-2xl border border-border bg-surface-inset px-4 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Skeleton className="h-7 w-14 rounded-full" />
                      <Skeleton className="h-7 w-16 rounded-full" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                    <Skeleton className="h-6 w-56" />
                    <Skeleton className="h-4 w-full max-w-xl" />
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                    <Skeleton className="h-10 w-24 rounded-full" />
                    <Skeleton className="h-10 w-24 rounded-full" />
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, metricIndex) => (
                    <MetricTileSkeleton key={metricIndex} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}

export function AdminLogsSkeleton() {
  return (
    <AdminShell title="로그 조회" backHref="/admin" backLabel="관리 홈">
      <div className="grid gap-8">
        <ShellHeaderSkeleton titleWidth="w-40" descriptionWidth="max-w-2xl" />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <SummaryCardSkeleton key={index} />
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <Card className="bg-surface-elevated shadow-[var(--shadow-raised)]">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="mt-2 h-4 w-full max-w-md" />
            <div className="mt-5 grid gap-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-border bg-surface-inset px-4 py-4"
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
              <Card key={index} className="bg-surface-elevated shadow-[var(--shadow-raised)]">
                <Skeleton className="h-7 w-32" />
                <Skeleton className="mt-2 h-4 w-full max-w-xs" />
                <div className="mt-4 grid gap-2">
                  {Array.from({ length: 3 }).map((__, rowIndex) => (
                    <div
                      key={rowIndex}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface-inset px-4 py-3"
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

        <section className="grid gap-4 rounded-3xl border border-border bg-surface p-5 shadow-[var(--shadow-flat)]">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-4 w-full max-w-md" />

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,0.75fr))]">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full rounded-2xl" />
            ))}
          </div>

          <div className="grid gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Card key={index} className="bg-surface-elevated shadow-[var(--shadow-raised)]">
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
