import AdminShell from "@/components/admin/AdminShell";
import Skeleton from "@/components/ui/Skeleton";
import Surface from "@/components/ui/Surface";

function PageHeaderSkeleton({ actionCount = 1 }: { actionCount?: number }) {
  return (
    <div className="flex min-w-0 flex-col gap-4 border-b border-border/70 pb-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="grid min-w-0 flex-1 gap-3">
        <Skeleton className="h-4 w-24 rounded-lg" />
        <Skeleton className="h-9 w-48 max-w-full" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: actionCount }).map((_, index) => (
          <Skeleton key={index} className="h-11 w-28 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

function MetricRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <Surface key={index} level="inset" padding="md" className="grid gap-2">
          <Skeleton className="h-4 w-20 rounded-lg" />
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-4 w-full max-w-[14rem]" />
        </Surface>
      ))}
    </div>
  );
}

function FilterSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <Surface level="elevated" padding="lg" className="grid min-w-0 gap-4">
      <div className="grid gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: fields }).map((_, index) => (
          <div key={index} className="grid min-w-0 gap-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-12 w-full rounded-2xl" />
          </div>
        ))}
      </div>
    </Surface>
  );
}

function ListRowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="grid min-w-0 gap-3">
      {Array.from({ length: rows }).map((_, index) => (
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
            <Skeleton className="h-4 w-full max-w-lg" />
          </div>
          <Skeleton className="h-11 w-24 rounded-2xl" />
        </Surface>
      ))}
    </div>
  );
}

function FormSkeleton({ sections = 2 }: { sections?: number }) {
  return (
    <div className="grid min-w-0 gap-4">
      {Array.from({ length: sections }).map((_, sectionIndex) => (
        <Surface key={sectionIndex} level={sectionIndex === 0 ? "elevated" : "default"} padding="lg" className="grid min-w-0 gap-4">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-4 w-full max-w-xl" />
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, fieldIndex) => (
              <Skeleton key={fieldIndex} className="h-12 w-full rounded-2xl" />
            ))}
          </div>
        </Surface>
      ))}
    </div>
  );
}

function AdminListSkeleton({
  title,
  actionCount = 2,
  filterFields = 4,
  rows = 4,
}: {
  title: string;
  actionCount?: number;
  filterFields?: number;
  rows?: number;
}) {
  return (
    <AdminShell title={title} backHref="/admin" backLabel="관리 홈">
      <div className="grid min-w-0 gap-6">
        <PageHeaderSkeleton actionCount={actionCount} />
        <MetricRowSkeleton />
        <FilterSkeleton fields={filterFields} />
        <ListRowsSkeleton rows={rows} />
      </div>
    </AdminShell>
  );
}

export function AdminLoginSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <Surface level="elevated" padding="lg" className="grid w-full max-w-md gap-5">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-12 w-full rounded-2xl" />
        <Skeleton className="h-12 w-full rounded-2xl" />
        <Skeleton className="h-12 w-full rounded-2xl" />
      </Surface>
    </div>
  );
}

export function AdminOverviewSkeleton() {
  return (
    <AdminShell title="관리 홈">
      <div className="grid min-w-0 gap-6">
        <PageHeaderSkeleton />
        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.8fr)]">
          <Surface level="elevated" padding="lg" className="grid gap-3">
            <Skeleton className="h-6 w-28" />
            <ListRowsSkeleton rows={3} />
          </Surface>
          <Surface level="default" padding="lg" className="grid gap-3">
            <Skeleton className="h-6 w-24" />
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full rounded-2xl" />
            ))}
          </Surface>
        </div>
        <MetricRowSkeleton />
      </div>
    </AdminShell>
  );
}

export function AdminProtectedSkeleton() {
  return <AdminListSkeleton title="관리 화면" />;
}

export function AdminMembersSkeleton() {
  return <AdminListSkeleton title="회원 관리" filterFields={4} rows={5} />;
}

export function AdminPartnersSkeleton() {
  return <AdminListSkeleton title="제휴처" actionCount={3} />;
}

export function AdminPartnerRequestsSkeleton() {
  return <AdminListSkeleton title="변경 요청" actionCount={1} filterFields={0} />;
}

export function AdminCategoriesSkeleton() {
  return <AdminListSkeleton title="카테고리" actionCount={1} filterFields={4} rows={3} />;
}

export function AdminPartnerDetailSkeleton() {
  return (
    <AdminShell title="제휴처 상세" backHref="/admin/partners" backLabel="제휴처">
      <div className="grid min-w-0 gap-6">
        <PageHeaderSkeleton />
        <MetricRowSkeleton />
        <FormSkeleton sections={3} />
      </div>
    </AdminShell>
  );
}

export function AdminPartnerCreateSkeleton() {
  return (
    <AdminShell title="제휴처 추가" backHref="/admin/partners" backLabel="제휴처">
      <div className="grid min-w-0 gap-6">
        <PageHeaderSkeleton />
        <FormSkeleton sections={2} />
      </div>
    </AdminShell>
  );
}

export function AdminCompaniesSkeleton() {
  return <AdminListSkeleton title="파트너사/계정" actionCount={2} />;
}

export function AdminCycleSkeleton() {
  return (
    <AdminShell title="기수 관리" backHref="/admin" backLabel="관리 홈">
      <div className="grid min-w-0 gap-6">
        <PageHeaderSkeleton />
        <MetricRowSkeleton count={3} />
        <FormSkeleton sections={1} />
      </div>
    </AdminShell>
  );
}

export function AdminReviewsSkeleton() {
  return <AdminListSkeleton title="리뷰 관리" filterFields={4} />;
}

export function AdminStyleGuideSkeleton() {
  return <AdminListSkeleton title="스타일 가이드" filterFields={0} rows={3} />;
}

export function AdminPushSkeleton() {
  return <AdminListSkeleton title="발송 관리" filterFields={3} rows={3} />;
}

export function AdminLogsSkeleton() {
  return <AdminListSkeleton title="로그 조회" filterFields={4} rows={5} />;
}
