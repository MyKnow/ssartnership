import { Suspense } from "react";
import AdminPartnerRegistrationsView from "@/components/admin/AdminPartnerRegistrationsView";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { AdminPartnerRegistrationsSkeletonContent } from "@/components/loading/AdminPageSkeletons";
import {
  updatePartnerRegistrationRequestDetails,
  updatePartnerRegistrationRequestStatus,
} from "@/app/admin/(protected)/partner-registrations/actions";
import AdminShell from "@/components/admin/AdminShell";
import Button from "@/components/ui/Button";
import { requireAdminPermission } from "@/lib/admin-access";
import { canAdmin } from "@/lib/admin-permissions";
import { getManagedCampusFilterValues } from "@/lib/admin-scope";
import { parseAdminReviewQueuePagination } from "@/lib/admin-ia";
import { listAdminPartnerRegistrationRequestPage } from "@/lib/admin-partner-registration-queue";
import {
  isPartnerRegistrationRequestStatus,
  PARTNER_REGISTRATION_QUEUE_SORT_OPTIONS,
  PARTNER_REGISTRATION_SOURCE_OPTIONS,
  type PartnerRegistrationQueueSort,
  type PartnerRegistrationSource,
} from "@/lib/partner-registration";
import { isPartnerVisibility } from "@/lib/partner-visibility";
import type { PartnerVisibility } from "@/lib/types";
import { getAdminReviewQueueFeedback } from "@/lib/admin-review-queue";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type PartnerRegistrationSearchParams = {
  status?: string | string[];
  error?: string | string[];
  success?: string | string[];
  page?: string | string[];
  pageSize?: string | string[];
  q?: string | string[];
  source?: string | string[];
  visibility?: string | string[];
  sort?: string | string[];
};

function getOneSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function buildPartnerRegistrationHref({
  status,
  search,
  source,
  visibility,
  sort,
  page,
  pageSize,
}: {
  status: string | null;
  search: string;
  source: PartnerRegistrationSource | null;
  visibility: "public" | "confidential" | "private" | null;
  sort: PartnerRegistrationQueueSort;
  page: number;
  pageSize: number;
}) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (search) params.set("q", search);
  if (source) params.set("source", source);
  if (visibility) params.set("visibility", visibility);
  if (sort !== "recent") params.set("sort", sort);
  if (page > 1) params.set("page", String(page));
  if (pageSize !== 12) params.set("pageSize", String(pageSize));
  const query = params.toString();
  return query
    ? `/admin/partner-registrations?${query}`
    : "/admin/partner-registrations";
}

async function AdminPartnerRegistrationsContent({
  adminSession,
  params,
}: {
  adminSession: Awaited<ReturnType<typeof requireAdminPermission>>;
  params: PartnerRegistrationSearchParams;
}) {
  const managedCampusFilter = getManagedCampusFilterValues(
    adminSession.account,
  );
  const canReview = canAdmin(
    adminSession.account.permissions,
    "brands",
    "update",
  );
  const canCreate = canAdmin(
    adminSession.account.permissions,
    "brands",
    "create",
  );
  const pagination = parseAdminReviewQueuePagination({
    page: getOneSearchParam(params.page),
    pageSize: getOneSearchParam(params.pageSize),
  });
  const statusValue = getOneSearchParam(params.status);
  const status =
    statusValue && isPartnerRegistrationRequestStatus(statusValue)
      ? statusValue
      : null;
  const search = (getOneSearchParam(params.q) ?? "").trim().slice(0, 100);
  const sourceValue = getOneSearchParam(params.source);
  const source = PARTNER_REGISTRATION_SOURCE_OPTIONS.includes(
    sourceValue as PartnerRegistrationSource,
  )
    ? (sourceValue as PartnerRegistrationSource)
    : null;
  const visibilityValue = getOneSearchParam(params.visibility);
  const visibility: PartnerVisibility | null = isPartnerVisibility(
    visibilityValue ?? "",
  )
    ? (visibilityValue as PartnerVisibility)
    : null;
  const sortValue = getOneSearchParam(params.sort);
  const sort = PARTNER_REGISTRATION_QUEUE_SORT_OPTIONS.some(
    (option) => option.value === sortValue,
  )
    ? (sortValue as PartnerRegistrationQueueSort)
    : "recent";
  const requestPage = await listAdminPartnerRegistrationRequestPage({
    status,
    search,
    source,
    visibility,
    sort,
    page: pagination.page,
    pageSize: pagination.pageSize,
    managedCampusSlugs: managedCampusFilter,
  });
  const totalPages = Math.max(
    1,
    Math.ceil(requestPage.totalCount / pagination.pageSize),
  );
  if (
    !requestPage.loadError &&
    requestPage.totalCount > 0 &&
    pagination.page > totalPages
  ) {
    redirect(
      buildPartnerRegistrationHref({
        status,
        search,
        source,
        visibility,
        sort,
        page: totalPages,
        pageSize: pagination.pageSize,
      }),
    );
  }
  const feedback = getAdminReviewQueueFeedback({
    error: getOneSearchParam(params.error),
    success: getOneSearchParam(params.success),
  });
  const returnTo = buildPartnerRegistrationHref({
    status,
    search,
    source,
    visibility,
    sort,
    page: pagination.page,
    pageSize: pagination.pageSize,
  });

  return (
    <AdminPartnerRegistrationsView
        rows={requestPage.rows}
        updateDetailsAction={updatePartnerRegistrationRequestDetails}
        updateStatusAction={updatePartnerRegistrationRequestStatus}
        status={status}
        search={search}
        source={source}
        visibility={visibility}
        sort={sort}
        feedback={feedback}
        returnTo={returnTo}
        pagination={{
          totalCount: requestPage.totalCount,
          page: pagination.page,
          pageSize: pagination.pageSize,
        }}
        loadError={requestPage.loadError}
        canReview={canReview}
        canCreate={canCreate}
        showHeader={false}
    />
  );
}

export default async function AdminPartnerRegistrationsPage({
  searchParams,
}: {
  searchParams?: Promise<PartnerRegistrationSearchParams>;
}) {
  const adminSession = await requireAdminPermission("brands", "read", {
    path: "/admin/partner-registrations",
  });
  const params = (await searchParams) ?? {};

  return (
    <AdminShell
      title="제휴 등록 신청"
      backHref="/admin/partners"
      backLabel="제휴처"
    >
      <div className="grid min-w-0 gap-6">
        <AdminPageHeader
          eyebrow="작업함"
          title="제휴 등록 신청 검토"
          description="공개 등록 페이지로 접수된 파트너사와 제휴처 정보를 확인하고 검토 상태를 관리합니다."
          actions={
            <>
              <Button
                variant="secondary"
                href="/partner-registration"
                target="_blank"
              >
                공개 신청 페이지
              </Button>
              {canAdmin(adminSession.account.permissions, "brands", "create") ? (
                <Button variant="soft" href="/admin/partners/new">
                  제휴처 추가
                </Button>
              ) : null}
            </>
          }
        />
        <Suspense fallback={<AdminPartnerRegistrationsSkeletonContent showHeader={false} />}>
          <AdminPartnerRegistrationsContent
            adminSession={adminSession}
            params={params}
          />
        </Suspense>
      </div>
    </AdminShell>
  );
}
