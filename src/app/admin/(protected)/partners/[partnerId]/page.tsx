import { notFound } from "next/navigation";
import { Suspense } from "react";
import AdminShell from "@/components/admin/AdminShell";
import {
  AdminPartnerDetailDeferredFallback,
  AdminPartnerDetailHistorySections,
  AdminPartnerDetailOperationalSections,
  AdminPartnerDetailReviewSection,
} from "@/components/admin/AdminPartnerDetailDeferredSections";
import AdminPartnerPreviewLinkPanel from "@/components/admin/AdminPartnerPreviewLinkPanel";
import AdminStatePanel from "@/components/admin/AdminStatePanel";
import PartnerCardForm from "@/components/PartnerCardForm";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import Surface from "@/components/ui/Surface";
import AdminSectionHeading from "@/components/admin/AdminSectionHeading";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { updatePartner } from "@/app/admin/(protected)/actions";
import {
  generatePartnerPreviewLink,
  removePartnerPreviewLink,
} from "@/app/admin/(protected)/_actions/partner-actions/preview";
import { adminActionErrorMessages } from "@/lib/admin-action-errors";
import { requireAdminPermission } from "@/lib/admin-access";
import { canAdmin } from "@/lib/admin-permissions";
import {
  assertAdminCanAccessManagedCampuses,
  getManagedCampusFilterValues,
} from "@/lib/admin-scope";
import {
  parseAdminReviewFilters,
  parseAdminReviewPagination,
  serializeAdminReviewPageQuery,
} from "@/lib/admin-reviews";
import { partnerFormErrorMessages } from "@/lib/partner-form-errors";
import { buildPartnerPreviewUrl } from "@/lib/partner-preview";
import { decryptPartnerPreviewToken } from "@/lib/partner-preview-token-crypto";
import { sanitizeAdminReturnTo } from "@/lib/admin-session-bridge";
import {
  getAdminPartnerDetailCoreReadModel,
  getAdminPartnerDetailOperationalReadModel,
} from "@/lib/admin-partner-detail.server";

export const dynamic = "force-dynamic";

const adminPartnerDetailErrorMessages: Record<string, string> = {
  ...partnerFormErrorMessages,
  ...adminActionErrorMessages,
};

function readFirstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function AdminPartnerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ partnerId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const adminSession = await requireAdminPermission("brands", "read", {
    path: "/admin/partners",
  });
  const { partnerId } = await params;
  const managedCampusFilter = getManagedCampusFilterValues(
    adminSession.account,
  );
  const query = (await searchParams) ?? {};
  const detailPath = `/admin/partners/${partnerId}`;
  const searchBackHref = sanitizeAdminReturnTo(
    readFirstQueryValue(query.returnTo),
    "/admin/partners",
  );
  const searchBackLabel = searchBackHref.startsWith("/admin/search")
    ? "검색 결과"
    : "제휴처";
  const partnerError = query.error
    ? (adminPartnerDetailErrorMessages[String(query.error)] ?? null)
    : null;
  const partnerSaved = query.success === "updated";
  const couponSuccessMessages: Record<string, string> = {
    "ad-coupon-created": "제휴처 쿠폰을 생성했습니다.",
    "ad-coupon-updated": "제휴처 쿠폰을 수정했습니다.",
    "ad-coupon-duplicated": "제휴처 쿠폰을 초안으로 복제했습니다.",
    "ad-coupon-deleted": "제휴처 쿠폰을 삭제했습니다.",
  };
  const couponSuccess = query.success
    ? (couponSuccessMessages[String(query.success)] ?? null)
    : null;
  const couponErrorMessages: Record<string, string> = {
    ad_coupon_delete_invalid_request: "쿠폰 삭제 요청을 다시 확인해 주세요.",
    ad_coupon_delete_not_found:
      "삭제할 쿠폰을 찾지 못했습니다. 목록을 다시 확인해 주세요.",
    ad_coupon_delete_has_history:
      "발급 또는 사용 이력이 있는 쿠폰은 삭제할 수 없습니다. 수정에서 상태를 종료로 변경해 주세요.",
    ad_coupon_delete_failed:
      "쿠폰을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  };
  const couponError = query.error
    ? (couponErrorMessages[String(query.error)] ?? null)
    : null;
  const usageSuccessMessages: Record<string, string> = {
    "usage-created": "혜택 적용 이력을 추가했습니다.",
    "usage-updated": "혜택 적용 이력을 수정했습니다.",
    "usage-deleted": "혜택 적용 이력을 삭제했습니다.",
  };
  const usageSuccess = query.success
    ? (usageSuccessMessages[String(query.success)] ?? null)
    : null;
  const canUpdatePartner = canAdmin(
    adminSession.account.permissions,
    "brands",
    "update",
  );
  const canUpdateReviews = canAdmin(
    adminSession.account.permissions,
    "reviews",
    "update",
  );
  const canDeleteReviews = canAdmin(
    adminSession.account.permissions,
    "reviews",
    "delete",
  );
  const canReadCoupons = canAdmin(
    adminSession.account.permissions,
    "home_ads",
    "read",
  );
  const canCreateCoupons = canAdmin(
    adminSession.account.permissions,
    "home_ads",
    "create",
  );
  const canUpdateCoupons = canAdmin(
    adminSession.account.permissions,
    "home_ads",
    "update",
  );
  const canDeleteCoupons = canAdmin(
    adminSession.account.permissions,
    "home_ads",
    "delete",
  );
  const canCreateBenefitUsage = canAdmin(
    adminSession.account.permissions,
    "brands",
    "create",
  );
  const canUpdateBenefitUsage = canAdmin(
    adminSession.account.permissions,
    "brands",
    "update",
  );
  const canDeleteBenefitUsage = canAdmin(
    adminSession.account.permissions,
    "brands",
    "delete",
  );

  const reviewFilters = {
    ...parseAdminReviewFilters(query),
    partnerId,
    companyId: "",
  };
  const reviewPagination = parseAdminReviewPagination(query);
  const retryParams = new URLSearchParams(
    serializeAdminReviewPageQuery(reviewFilters, reviewPagination),
  );
  const requestedUsageBenefit = readFirstQueryValue(query.usageBenefit);
  const requestedUsagePage = readFirstQueryValue(query.usagePage);
  if (requestedUsageBenefit)
    retryParams.set("usageBenefit", requestedUsageBenefit);
  if (requestedUsagePage) retryParams.set("usagePage", requestedUsagePage);
  if (searchBackHref !== "/admin/partners")
    retryParams.set("returnTo", searchBackHref);
  const retryQueryString = retryParams.toString();
  const retryHref = retryQueryString
    ? `${detailPath}?${retryQueryString}`
    : detailPath;
  const detail = await getAdminPartnerDetailCoreReadModel({
    partnerId,
    managedCampusSlugs: managedCampusFilter,
  });

  if (detail.status === "not_found") {
    notFound();
  }
  if (detail.status === "error") {
    return (
      <AdminShell
        title="제휴처 상세"
        backHref={searchBackHref}
        backLabel={searchBackLabel}
      >
        <AdminStatePanel
          kind="error"
          title="제휴처 정보를 불러오지 못했습니다."
          description="잠시 후 다시 확인해 주세요. 문제가 계속되면 운영 기록을 확인해 주세요."
          action={
            <Button href={retryHref} variant="secondary">
              다시 확인
            </Button>
          }
        />
      </AdminShell>
    );
  }

  const { partner, company, categories, companies, previewToken } = detail;
  try {
    assertAdminCanAccessManagedCampuses(
      adminSession.account,
      (partner as { managed_campus_slugs?: string[] | null })
        .managed_campus_slugs,
    );
  } catch {
    notFound();
  }
  const operationalPromise = getAdminPartnerDetailOperationalReadModel({
    core: detail,
    partnerId,
    managedCampusSlugs: managedCampusFilter,
    reviewFilters,
    reviewPagination,
    canReadCoupons,
    requestedUsageBenefit,
    usagePage: requestedUsagePage,
  });
  const reviewQueryString = serializeAdminReviewPageQuery(
    reviewFilters,
    reviewPagination,
  );
  const returnTo = reviewQueryString
    ? `${detailPath}?${reviewQueryString}`
    : detailPath;
  const thumbnail = partner.thumbnail ?? partner.images?.[0] ?? null;
  const galleryImages = partner.thumbnail
    ? (partner.images ?? [])
    : (partner.images ?? []).slice(1);
  const previewTokenRow = previewToken;
  let initialPreviewUrl: string | null = null;
  if (
    canUpdatePartner &&
    previewTokenRow?.token_ciphertext &&
    previewTokenRow.token_nonce &&
    previewTokenRow.token_auth_tag &&
    typeof previewTokenRow.token_key_version === "number"
  ) {
    try {
      const token = decryptPartnerPreviewToken(partner.id, {
        ciphertext: previewTokenRow.token_ciphertext,
        nonce: previewTokenRow.token_nonce,
        authTag: previewTokenRow.token_auth_tag,
        keyVersion: previewTokenRow.token_key_version,
      });
      initialPreviewUrl = buildPartnerPreviewUrl(partner.id, token);
    } catch {
      initialPreviewUrl = null;
    }
  }

  return (
    <AdminShell
      title={partner.name}
      backHref={searchBackHref}
      backLabel={searchBackLabel}
    >
      <section className="grid min-w-0 gap-6">
        <AdminPageHeader
          eyebrow="제휴처"
          title={partner.name}
          description="기본 정보를 바로 수정하고, 운영 지표·혜택 이력·쿠폰은 아래에서 필요할 때 확인합니다."
          actions={
            canUpdatePartner ? (
              <Button href="#partner-edit">기본 정보 수정</Button>
            ) : null
          }
        />

        {partnerError ? (
          <FormMessage variant="error">{partnerError}</FormMessage>
        ) : null}
        {couponSuccess ? (
          <FormMessage variant="info">{couponSuccess}</FormMessage>
        ) : null}
        {usageSuccess ? (
          <FormMessage variant="info">{usageSuccess}</FormMessage>
        ) : null}

        <AdminPartnerPreviewLinkPanel
          partnerId={partner.id}
          hasActiveLink={Boolean(previewTokenRow?.created_at)}
          initialPreviewUrl={initialPreviewUrl}
          canUpdate={canUpdatePartner}
          generateAction={generatePartnerPreviewLink}
          removeAction={removePartnerPreviewLink}
        />

        <Suspense
          fallback={
            <AdminPartnerDetailDeferredFallback label="운영 지표와 혜택·쿠폰 정보를 불러오는 중입니다." />
          }
        >
          <AdminPartnerDetailOperationalSections
            operational={operationalPromise}
            core={detail}
            partnerId={partnerId}
            detailPath={detailPath}
            retryHref={retryHref}
            partnerPeriodEnd={partner.period_end}
            canCreateBenefitUsage={canCreateBenefitUsage}
            canUpdateBenefitUsage={canUpdateBenefitUsage}
            canDeleteBenefitUsage={canDeleteBenefitUsage}
            canCreateCoupons={canCreateCoupons}
            canUpdateCoupons={canUpdateCoupons}
            canDeleteCoupons={canDeleteCoupons}
            couponError={couponError}
          />
        </Suspense>

        <div
          id="partner-edit"
          className="grid scroll-mt-24 gap-6 2xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.72fr)] 2xl:items-start"
        >
          <div className="grid min-w-0 gap-4">
            <AdminSectionHeading
              title={canUpdatePartner ? "제휴처 수정" : "제휴처 기본 정보"}
              description={
                canUpdatePartner
                  ? "목록에서는 핵심 정보만 확인하고 이 상세 화면에서 제휴처 정보를 수정합니다."
                  : "기본 정보는 확인할 수 있지만 제휴처 수정 권한이 없어 변경할 수 없습니다."
              }
            />
            {canUpdatePartner ? (
              <PartnerCardForm
                mode="edit"
                partner={{
                  id: partner.id,
                  name: partner.name ?? "",
                  visibility: partner.visibility,
                  benefitVisibility: partner.benefit_visibility ?? "public",
                  location: partner.location ?? "",
                  detailDescription: partner.detail_description ?? "",
                  campusSlugs: partner.campus_slugs ?? [],
                  mapUrl: partner.map_url ?? "",
                  benefitActionType: partner.benefit_action_type ?? undefined,
                  benefitActionLink: partner.benefit_action_link ?? undefined,
                  benefitItems: (partner.partner_benefits ?? []).map(
                    (benefit: {
                      id: string;
                      title: string;
                      max_apply_count: number | null;
                      display_order?: number | null;
                    }) => ({
                      id: benefit.id,
                      title: benefit.title,
                      maxApplyCount: benefit.max_apply_count,
                      displayOrder: benefit.display_order ?? undefined,
                    }),
                  ),
                  benefitVerificationPinConfigured: Boolean(
                    partner.benefit_verification_pin_hash &&
                    partner.benefit_verification_pin_salt,
                  ),
                  reservationLink: partner.reservation_link ?? "",
                  inquiryLink: partner.inquiry_link ?? "",
                  period: {
                    start: partner.period_start ?? "",
                    end: partner.period_end ?? "",
                  },
                  conditions: partner.conditions ?? [],
                  benefits: partner.benefits ?? [],
                  appliesTo: partner.applies_to ?? [],
                  thumbnail,
                  images: galleryImages,
                  tags: partner.tags ?? [],
                  company: company
                    ? {
                        id: company.id,
                        name: company.name,
                        description: company.description ?? "",
                        contactName: "",
                        contactEmail: "",
                        contactPhone: "",
                      }
                    : null,
                }}
                categoryOptions={categories.map((item) => ({
                  id: item.id,
                  label: item.label,
                }))}
                companyOptions={companies.map((item) => ({
                  id: item.id,
                  name: item.name,
                  slug: item.slug,
                }))}
                categoryId={partner.category_id}
                formAction={updatePartner}
                submitLabel="제휴처 저장"
                clearDraftOnSuccess={partnerSaved}
                hiddenFields={[{ name: "updateRedirectTo", value: detailPath }]}
              />
            ) : (
              <Surface
                level="inset"
                padding="lg"
                className="grid min-w-0 gap-5"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    조회 전용 권한
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    제휴처 기본 정보와 운영 상태는 확인할 수 있지만, 수정은
                    제휴처 운영 권한이 있는 관리자만 할 수 있습니다.
                  </p>
                </div>
                <dl className="grid min-w-0 gap-4 sm:grid-cols-2">
                  <div className="min-w-0">
                    <dt className="ui-caption">제휴처명</dt>
                    <dd className="mt-1 break-words text-sm font-semibold text-foreground">
                      {partner.name}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="ui-caption">파트너사</dt>
                    <dd className="mt-1 break-words text-sm font-semibold text-foreground">
                      {company?.name ?? "회사 미연결"}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="ui-caption">노출 상태</dt>
                    <dd className="mt-1 text-sm font-semibold text-foreground">
                      {partner.visibility === "public" ? "공개" : "비공개"}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="ui-caption">운영 기간</dt>
                    <dd className="mt-1 text-sm font-semibold text-foreground">
                      {partner.period_start ?? "시작일 미입력"} ~{" "}
                      {partner.period_end ?? "종료일 미입력"}
                    </dd>
                  </div>
                </dl>
              </Surface>
            )}
          </div>

          <div className="2xl:sticky 2xl:top-24">
            <Suspense
              fallback={
                <AdminPartnerDetailDeferredFallback label="수정 이력을 불러오는 중입니다." />
              }
            >
              <AdminPartnerDetailHistorySections
                operational={operationalPromise}
              />
            </Suspense>
          </div>
        </div>

        <Suspense
          fallback={
            <AdminPartnerDetailDeferredFallback label="리뷰를 불러오는 중입니다." />
          }
        >
          <AdminPartnerDetailReviewSection
            operational={operationalPromise}
            detailPath={detailPath}
            reviewFilters={reviewFilters}
            returnTo={returnTo}
            canUpdate={canUpdateReviews}
            canDelete={canDeleteReviews}
          />
        </Suspense>
      </section>
    </AdminShell>
  );
}
