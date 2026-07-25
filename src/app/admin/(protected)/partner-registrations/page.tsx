import AdminPartnerRegistrationsView from "@/components/admin/AdminPartnerRegistrationsView";
import { updatePartnerRegistrationRequestStatus } from "@/app/admin/(protected)/partner-registrations/actions";
import AdminShell from "@/components/admin/AdminShell";
import { requireAdminPermission } from "@/lib/admin-access";
import { getManagedCampusFilterValues } from "@/lib/admin-scope";
import { parseAdminReviewQueuePagination } from "@/lib/admin-ia";
import { listAdminPartnerRegistrationRequestPage } from "@/lib/admin-partner-registration-queue";
import { isPartnerRegistrationRequestStatus } from "@/lib/partner-registration";
import { getAdminReviewQueueFeedback } from "@/lib/admin-review-queue";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type PartnerRegistrationSearchParams = {
  status?: string | string[];
  error?: string | string[];
  success?: string | string[];
  page?: string | string[];
  pageSize?: string | string[];
};

function getOneSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function buildPartnerRegistrationHref({
  status,
  page,
  pageSize,
}: {
  status: string | null;
  page: number;
  pageSize: number;
}) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (page > 1) params.set("page", String(page));
  if (pageSize !== 12) params.set("pageSize", String(pageSize));
  const query = params.toString();
  return query ? `/admin/partner-registrations?${query}` : "/admin/partner-registrations";
}

export default async function AdminPartnerRegistrationsPage({
  searchParams,
}: {
  searchParams?: Promise<PartnerRegistrationSearchParams>;
}) {
  const adminSession = await requireAdminPermission("brands", "read", {
    path: "/admin/partner-registrations",
  });
  const managedCampusFilter = getManagedCampusFilterValues(adminSession.account);
  const params = (await searchParams) ?? {};
  const pagination = parseAdminReviewQueuePagination({
    page: getOneSearchParam(params.page),
    pageSize: getOneSearchParam(params.pageSize),
  });
  const statusValue = getOneSearchParam(params.status);
  const status =
    statusValue && isPartnerRegistrationRequestStatus(statusValue)
      ? statusValue
      : null;
  const requestPage = await listAdminPartnerRegistrationRequestPage({
    status,
    page: pagination.page,
    pageSize: pagination.pageSize,
    managedCampusSlugs: managedCampusFilter,
  });
  const totalPages = Math.max(1, Math.ceil(requestPage.totalCount / pagination.pageSize));
  if (!requestPage.loadError && requestPage.totalCount > 0 && pagination.page > totalPages) {
    redirect(buildPartnerRegistrationHref({
      status,
      page: totalPages,
      pageSize: pagination.pageSize,
    }));
  }
  const feedback = getAdminReviewQueueFeedback({
    error: getOneSearchParam(params.error),
    success: getOneSearchParam(params.success),
  });
  const returnTo = buildPartnerRegistrationHref({
    status,
    page: pagination.page,
    pageSize: pagination.pageSize,
  });

  return (
    <AdminShell
      title="제휴 등록 신청"
      backHref="/admin/partners"
      backLabel="제휴처"
    >
      <AdminPartnerRegistrationsView
        rows={requestPage.rows}
        updateStatusAction={updatePartnerRegistrationRequestStatus}
        status={status}
        feedback={feedback}
        returnTo={returnTo}
        pagination={{
          totalCount: requestPage.totalCount,
          page: pagination.page,
          pageSize: pagination.pageSize,
        }}
        loadError={requestPage.loadError}
      />
    </AdminShell>
  );
}
