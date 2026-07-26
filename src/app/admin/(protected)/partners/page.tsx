import { permanentRedirect, redirect } from "next/navigation";
import AdminCompanyPlanManager from "@/components/admin/AdminCompanyPlanManager";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminPartnerCreateToast from "@/components/admin/AdminPartnerCreateToast";
import AdminPartnerManager from "@/components/admin/AdminPartnerManager";
import AdminSectionHeading from "@/components/admin/AdminSectionHeading";
import AdminShell from "@/components/admin/AdminShell";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import InlineMessage from "@/components/ui/InlineMessage";
import StatsRow from "@/components/ui/StatsRow";
import { requireAdminPermission } from "@/lib/admin-access";
import { adminActionErrorMessages } from "@/lib/admin-action-errors";
import {
  parseAdminPartnerListFilters,
  resolveAdminPartnerTabRedirect,
} from "@/lib/admin-ia";
import { getAdminPartnerListReadModel } from "@/lib/admin-partner-list.server";
import { canAdmin } from "@/lib/admin-permissions";
import {
  getManagedCampusFilterValues,
  isRegionalAdminAccount,
} from "@/lib/admin-scope";
import { partnerFormErrorMessages } from "@/lib/partner-form-errors";

export const dynamic = "force-dynamic";

const adminPartnersErrorMessages: Record<string, string> = {
  ...partnerFormErrorMessages,
  ...adminActionErrorMessages,
};

type AdminPartnersSearchParams = {
  error?: string | string[];
  tab?: string | string[];
  q?: string | string[];
  category?: string | string[];
  visibility?: string | string[];
  sort?: string | string[];
  page?: string | string[];
  pageSize?: string | string[];
};

function getOneSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function buildPartnerListHref(input: {
  q?: string;
  category?: string;
  visibility?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
}) {
  const params = new URLSearchParams();
  if (input.q) params.set("q", input.q);
  if (input.category && input.category !== "all") {
    params.set("category", input.category);
  }
  if (input.visibility && input.visibility !== "all") {
    params.set("visibility", input.visibility);
  }
  if (input.sort && input.sort !== "recent") params.set("sort", input.sort);
  if (input.page && input.page > 1) params.set("page", String(input.page));
  if (input.pageSize && input.pageSize !== 24) {
    params.set("pageSize", String(input.pageSize));
  }

  const query = params.toString();
  return query ? `/admin/partners?${query}` : "/admin/partners";
}

export default async function AdminPartnersPage({
  searchParams,
}: {
  searchParams?: Promise<AdminPartnersSearchParams>;
}) {
  const adminSession = await requireAdminPermission("brands", "read", {
    path: "/admin/partners",
  });
  const managedCampusFilter = getManagedCampusFilterValues(adminSession.account);
  const canManageGlobalSections = !isRegionalAdminAccount(adminSession.account);
  const params = (await searchParams) ?? {};
  const tab = getOneSearchParam(params.tab);
  const partnerFormError = getOneSearchParam(params.error)
    ? adminPartnersErrorMessages[getOneSearchParam(params.error) ?? ""]
    : null;
  const legacyTabRedirect = resolveAdminPartnerTabRedirect(tab);
  if (legacyTabRedirect) {
    permanentRedirect(legacyTabRedirect);
  }

  const showPlans = tab === "plans" && canManageGlobalSections;
  if (tab === "plans" && !canManageGlobalSections) {
    redirect("/admin/partners");
  }

  const requestedFilters = parseAdminPartnerListFilters({
    q: getOneSearchParam(params.q),
    category: getOneSearchParam(params.category),
    visibility: getOneSearchParam(params.visibility),
    sort: getOneSearchParam(params.sort),
    page: getOneSearchParam(params.page),
    pageSize: getOneSearchParam(params.pageSize),
  });
  const partnerList = await getAdminPartnerListReadModel({
    filters: requestedFilters,
    showPlans,
    managedCampusSlugs: managedCampusFilter,
  });

  if (partnerList.shouldRedirectToLastPage) {
    redirect(
      buildPartnerListHref({
        q: partnerList.filters.searchValue,
        category: partnerList.filters.categoryKey,
        visibility: partnerList.filters.visibility,
        sort: partnerList.filters.sort,
        page: partnerList.totalPartnerPages,
        pageSize: partnerList.filters.pageSize,
      }),
    );
  }

  const canCreatePartner = canAdmin(
    adminSession.account.permissions,
    "brands",
    "create",
  );

  return (
    <AdminShell
      title={showPlans ? "플랜/과금" : "제휴처"}
      backHref="/admin"
      backLabel="관리 홈"
    >
      <section className="grid gap-6">
        <AdminPartnerCreateToast />
        <AdminPageHeader
          eyebrow="제휴 운영"
          title={showPlans ? "플랜과 과금 관리" : "제휴처 목록"}
          description={
            showPlans
              ? "제휴처별 플랜, 결제 요청, 변경 이력을 관리합니다."
              : "사용자에게 노출되는 제휴처의 혜택과 공개 상태를 검색하고 상세 화면에서 수정합니다."
          }
          actions={
            showPlans ? (
              <Button variant="secondary" href="/admin/partners">
                제휴처 목록
              </Button>
            ) : (
              <>
                <Button variant="secondary" href="/admin/partner-requests">
                  변경 요청
                </Button>
                {canManageGlobalSections ? (
                  <Button variant="secondary" href="/admin/categories">
                    카테고리
                  </Button>
                ) : null}
                {canCreatePartner ? (
                  <Button variant="soft" href="/admin/partners/new">
                    제휴처 추가
                  </Button>
                ) : null}
              </>
            )
          }
        />

        {showPlans ? (
          <StatsRow
            items={[
              {
                label: "제휴처",
                value: `${partnerList.partners.length.toLocaleString("ko-KR")}개`,
                hint: "현재 등록된 노출 단위",
              },
              {
                label: "카테고리",
                value: `${partnerList.categories.length.toLocaleString("ko-KR")}개`,
                hint: "운영 중인 분류 체계",
              },
              {
                label: "공개/대외비",
                value: `${partnerList.publicCount.toLocaleString("ko-KR")} · ${partnerList.confidentialCount.toLocaleString("ko-KR")}`,
                hint: "공개 · 대외비",
              },
              {
                label: "비공개",
                value: `${partnerList.privateCount.toLocaleString("ko-KR")}개`,
                hint: "사용자 화면 비노출",
              },
            ]}
            minItemWidth="13rem"
          />
        ) : null}

        {partnerFormError ? (
          <FormMessage variant="error">{partnerFormError}</FormMessage>
        ) : null}

        {showPlans ? (
          <section className="grid min-w-0 gap-4">
            <AdminSectionHeading
              title="제휴처 플랜"
              description="결제 요청과 플랜 변경 이력을 같은 기준으로 확인합니다."
            />
            {partnerList.hasPartnerLoadError || partnerList.hasPlanLoadError ? (
              <InlineMessage
                tone="danger"
                title="플랜 데이터를 불러오지 못했습니다."
                description="잠시 후 다시 확인해 주세요. 문제가 계속되면 운영 담당자에게 알려 주세요."
                actionHref="/admin/partners?tab=plans"
                actionLabel="다시 확인"
              />
            ) : (
              <AdminCompanyPlanManager
                brands={partnerList.planBrands}
                requests={partnerList.planRequests}
                events={partnerList.planEvents}
              />
            )}
          </section>
        ) : (
          <section className="grid min-w-0 gap-4">
            <AdminPartnerManager
              categories={partnerList.categories}
              partners={partnerList.partners}
              pagination={{
                totalCount: partnerList.totalPartnerCount,
                page: partnerList.filters.page,
                pageSize: partnerList.filters.pageSize,
              }}
              filters={partnerList.filters}
              loadError={partnerList.hasPartnerLoadError}
            />
          </section>
        )}
      </section>
    </AdminShell>
  );
}
