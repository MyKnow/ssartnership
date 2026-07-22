import { redirect } from "next/navigation";
import { requireAdminPermission } from "@/lib/admin-access";
import { assertAdminCanAccessManagedCampuses } from "@/lib/admin-scope";
import { buildAuditChangeSummary } from "@/lib/audit-change-summary";
import { deletePartnerMediaUrls } from "@/lib/partner-media-storage";
import {
  clearNewPartnerNotificationSent,
  sendAndRecordCampusScopedNewPartnerNotification,
} from "@/lib/new-partner-notifications";
import {
  getPartnerVisibilityState,
  normalizePartnerVisibility,
  shouldNotifyPartnerBecamePublic,
} from "@/lib/partner-visibility";
import { hashCouponVerificationPassword } from "@/lib/coupon-verification-password";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  cleanupPartnerCompanyProvision,
  collectPartnerMediaUrls,
  ensurePartnerCompanyRow,
  resolvePartnerMediaPayload,
} from "@/app/admin/(protected)/_actions/partner-support";
import {
  logAdminAction,
  revalidateAdminAndPublicPaths,
  revalidatePartnerData,
} from "@/app/admin/(protected)/_actions/shared-helpers";
import {
  parsePartnerCompanyPayloadOrRedirect,
  parsePartnerPayloadOrRedirect,
} from "@/app/admin/(protected)/_actions/shared-parser-redirects";

function getSafeAdminPartnerPath(value: FormDataEntryValue | null, fallback: string) {
  const candidate = typeof value === "string" ? value.trim() : "";
  if (candidate.startsWith("/admin/partners")) {
    return candidate;
  }
  return fallback;
}

function getUpdatedPartnerRedirectPath(path: string) {
  return `${path}${path.includes("?") ? "&" : "?"}success=updated`;
}

function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function updatePartnerAction(formData: FormData) {
  const adminSession = await requireAdminPermission("brands", "update", {
    path: "/admin/partners",
  });
  const id = String(formData.get("id") || "").trim();
  if (!id) {
    throw new Error("수정할 제휴처를 찾을 수 없습니다.");
  }

  const redirectPath = getSafeAdminPartnerPath(
    formData.get("updateRedirectTo"),
    "/admin/partners",
  );

  const payload = parsePartnerPayloadOrRedirect(formData, redirectPath);
  const supabase = getSupabaseAdminClient();
  const { data: previousPartner, error: previousPartnerError } = await supabase
    .from("partners")
    .select(
      "company_id,category_id,name,location,detail_description,campus_slugs,managed_campus_slugs,map_url,benefit_action_type,benefit_action_link,benefit_use_max_count,reservation_link,inquiry_link,period_start,period_end,conditions,benefits,applies_to,thumbnail,images,tags,visibility,benefit_visibility,benefit_verification_pin_hash,benefit_verification_pin_salt,company:partner_companies(id,name,slug,managed_campus_slugs),categories(id,label)",
    )
    .eq("id", id)
    .maybeSingle();

  if (previousPartnerError) {
    throw new Error(previousPartnerError.message);
  }
  if (!previousPartner) {
    throw new Error("수정할 제휴처를 찾을 수 없습니다.");
  }
  const previousVisibility = normalizePartnerVisibility(previousPartner.visibility);
  const previousVisibilityState = getPartnerVisibilityState(
    previousVisibility,
    previousPartner.period_start,
    previousPartner.period_end,
  );
  const nextVisibilityState = getPartnerVisibilityState(
    payload.visibility,
    payload.periodStart,
    payload.periodEnd,
  );
  const shouldNotifyPublicTransition = shouldNotifyPartnerBecamePublic(
    previousVisibilityState,
    nextVisibilityState,
  );
  const previousManagedCampusSlugs =
    (previousPartner as { managed_campus_slugs?: string[] | null }).managed_campus_slugs ??
    [];
  assertAdminCanAccessManagedCampuses(
    adminSession.account,
    previousManagedCampusSlugs,
  );

  const previousCompany = normalizeRelation<{
    id: string;
    name: string;
    slug: string;
    managed_campus_slugs?: string[] | null;
  }>((previousPartner as { company?: unknown }).company as
    | {
        id: string;
        name: string;
        slug: string;
        managed_campus_slugs?: string[] | null;
      }
    | Array<{
        id: string;
        name: string;
        slug: string;
        managed_campus_slugs?: string[] | null;
      }>
    | null
    | undefined);
  const previousCategory = normalizeRelation<{
    id: string;
    label: string;
  }>((previousPartner as { categories?: unknown }).categories as
    | {
        id: string;
        label: string;
      }
    | Array<{
        id: string;
        label: string;
      }>
    | null
    | undefined);

  const companyPayload = parsePartnerCompanyPayloadOrRedirect(
    formData,
    redirectPath,
  );
  const media = await resolvePartnerMediaPayload(
    formData,
    id,
    collectPartnerMediaUrls(previousPartner),
  );
  const previousBenefitVerificationPinHash =
    (previousPartner as { benefit_verification_pin_hash?: string | null })
      .benefit_verification_pin_hash ?? null;
  const previousBenefitVerificationPinSalt =
    (previousPartner as { benefit_verification_pin_salt?: string | null })
      .benefit_verification_pin_salt ?? null;
  const nextBenefitVerificationPin = payload.benefitVerificationPin
    ? await hashCouponVerificationPassword(payload.benefitVerificationPin)
    : payload.serviceMode === "online"
      ? null
      : previousBenefitVerificationPinHash && previousBenefitVerificationPinSalt
        ? {
            hash: previousBenefitVerificationPinHash,
            salt: previousBenefitVerificationPinSalt,
          }
        : null;
  const hasCompanyPayload = Boolean(
    companyPayload.companyId ||
      companyPayload.name ||
      companyPayload.description ||
      companyPayload.contactName ||
      companyPayload.contactEmail ||
      companyPayload.contactPhone,
  );
  let companyProvision = null;
  let nextCompanyId = previousPartner.company_id ?? null;

  if (hasCompanyPayload) {
    companyProvision = await ensurePartnerCompanyRow(
      supabase,
      companyPayload,
      Boolean(previousPartner.company_id || hasCompanyPayload),
      { managedCampusSlugs: previousManagedCampusSlugs },
    );
    if (companyProvision.company) {
      assertAdminCanAccessManagedCampuses(
        adminSession.account,
        companyProvision.company.managed_campus_slugs,
      );
      nextCompanyId = companyProvision.company.id;
    }
  }

  try {
    const { data: updatedPartner, error } = await supabase
      .from("partners")
      .update({
        company_id: nextCompanyId,
        name: payload.name,
        category_id: payload.categoryId,
        location: payload.location,
        detail_description: payload.detailDescription,
        campus_slugs: payload.campusSlugs,
        map_url: payload.mapUrl,
        benefit_action_type: payload.benefitActionType,
        benefit_action_link: payload.benefitActionLink,
        benefit_use_max_count: payload.benefitUseMaxCount,
        benefit_verification_pin_hash: nextBenefitVerificationPin?.hash ?? null,
        benefit_verification_pin_salt: nextBenefitVerificationPin?.salt ?? null,
        reservation_link: payload.reservationLink,
        inquiry_link: payload.inquiryLink,
        period_start: payload.periodStart,
        period_end: payload.periodEnd,
        conditions: payload.conditions,
        benefits: payload.benefits,
        applies_to: payload.appliesTo,
        thumbnail: media.thumbnail,
        images: media.images,
        tags: payload.tags,
        visibility: payload.visibility,
        benefit_visibility: payload.benefitVisibility,
      })
      .eq("id", id)
      .select("id")
      .single();

    if (error) {
      throw new Error(error.message);
    }
    if (!updatedPartner?.id) {
      throw new Error("제휴처 저장 결과를 확인할 수 없습니다.");
    }
  } catch (error) {
    await deletePartnerMediaUrls(media.uploadedUrls).catch(() => undefined);
    await cleanupPartnerCompanyProvision(supabase, companyProvision);
    throw error;
  }

  const previousUrls = collectPartnerMediaUrls(previousPartner);
  const nextUrls = collectPartnerMediaUrls({
    thumbnail: media.thumbnail,
    images: media.images,
  });
  const removedUrls = previousUrls.filter((url) => !nextUrls.includes(url));
  await deletePartnerMediaUrls(removedUrls).catch(() => undefined);

  const nextCompany = companyProvision?.company ?? previousCompany;
  const nextCategoryLabel =
    payload.categoryId === previousPartner.category_id
      ? previousCategory?.label ?? payload.categoryId
      : (await supabase
          .from("categories")
          .select("id,label")
          .eq("id", payload.categoryId)
          .maybeSingle()).data?.label ?? payload.categoryId;
  const previousCompanyLabel = previousCompany?.name ?? "없음";
  const nextCompanyLabel = nextCompany?.name ?? "없음";

  if (nextVisibilityState !== "public" || shouldNotifyPublicTransition) {
    try {
      await clearNewPartnerNotificationSent(id);
    } catch (error) {
      console.error("[partner-update] publication notification state reset failed", error);
    }
  }

  if (shouldNotifyPublicTransition) {
    try {
      await sendAndRecordCampusScopedNewPartnerNotification({
        partnerId: id,
        name: payload.name,
        location: payload.location,
        categoryLabel: nextCategoryLabel,
        campusSlugs: payload.campusSlugs,
        benefitSummary: payload.benefits.join("\n"),
        conditions: payload.conditions.join("\n"),
        periodStart: payload.periodStart,
        periodEnd: payload.periodEnd,
        mapUrl: payload.mapUrl,
      });
    } catch (error) {
      console.error("[partner-update] public transition notification failed", error);
    }
  }
  const partnerAudit = buildAuditChangeSummary("제휴처", [
    {
      label: "회사 연결",
      before: previousCompanyLabel,
      after: nextCompanyLabel,
    },
    {
      label: "제휴처명",
      before: previousPartner.name ?? "",
      after: payload.name,
    },
    {
      label: "카테고리",
      before: previousCategory?.label ?? payload.categoryId,
      after: nextCategoryLabel,
    },
    {
      label: "위치/운영 형태",
      before: previousPartner.location ?? "",
      after: payload.location,
    },
    {
      label: "상세 설명",
      before: previousPartner.detail_description ?? null,
      after: payload.detailDescription,
      format: (value) => (value ? "입력됨" : "없음"),
      describeChange: (before, after) => {
        const beforeText = before ? "입력됨" : "없음";
        const afterText = after ? "입력됨" : "없음";
        return beforeText === afterText
          ? "상세 설명 내용이 수정되었습니다."
          : `상세 설명: ${beforeText} → ${afterText}`;
      },
    },
    {
      label: "노출 캠퍼스",
      before: previousPartner.campus_slugs ?? [],
      after: payload.campusSlugs,
    },
    {
      label: "지도/사이트 링크",
      before: previousPartner.map_url ?? null,
      after: payload.mapUrl,
      format: (value) => (value ? String(value) : "없음"),
    },
    {
      label: "혜택 이용 방식",
      before: previousPartner.benefit_action_type ?? "none",
      after: payload.benefitActionType,
    },
    {
      label: "혜택 이용 링크",
      before: previousPartner.benefit_action_link ?? previousPartner.reservation_link ?? null,
      after: payload.benefitActionLink,
      format: (value) => (value ? String(value) : "없음"),
    },
    {
      label: "제휴 적용 최대 횟수",
      before: previousPartner.benefit_use_max_count ?? null,
      after: payload.benefitUseMaxCount,
      format: (value) => (value == null ? "무제한" : `${value}회`),
    },
    {
      label: "문의 링크",
      before: previousPartner.inquiry_link ?? null,
      after: payload.inquiryLink,
      format: (value) => (value ? String(value) : "없음"),
    },
    {
      label: "제휴 시작일",
      before: previousPartner.period_start ?? null,
      after: payload.periodStart,
    },
    {
      label: "제휴 종료일",
      before: previousPartner.period_end ?? null,
      after: payload.periodEnd,
    },
    {
      label: "이용조건",
      before: previousPartner.conditions ?? [],
      after: payload.conditions,
    },
    {
      label: "이용혜택",
      before: previousPartner.benefits ?? [],
      after: payload.benefits,
    },
    {
      label: "노출 대상",
      before: previousPartner.applies_to ?? [],
      after: payload.appliesTo,
    },
    {
      label: "메인 썸네일",
      before: previousPartner.thumbnail ? "설정됨" : "없음",
      after: media.thumbnail ? "설정됨" : "없음",
      describeChange: (before, after) => {
        if (before === after) {
          return null;
        }
        return `메인 썸네일: ${String(before)} → ${String(after)}`;
      },
    },
    {
      label: "추가 이미지 수",
      before: previousPartner.images?.length ?? 0,
      after: media.images.length,
      format: (value) => `${Number(value) || 0}장`,
    },
    {
      label: "태그",
      before: previousPartner.tags ?? [],
      after: payload.tags,
    },
    {
      label: "공개 상태",
      before: previousPartner.visibility,
      after: payload.visibility,
    },
    {
      label: "혜택 공개 범위",
      before: previousPartner.benefit_visibility ?? "public",
      after: payload.benefitVisibility,
    },
  ]);

  if (partnerAudit.changedFields.length > 0) {
    await logAdminAction("partner_update", {
      targetType: "partner",
      targetId: id,
      properties: {
        summary: partnerAudit.summary,
        changedFields: partnerAudit.changedFields,
        changes: partnerAudit.changes,
        fieldChanges: partnerAudit.fieldChanges,
        companyName: nextCompanyLabel,
        categoryLabel: nextCategoryLabel,
        visibility: payload.visibility,
        benefitVisibility: payload.benefitVisibility,
        benefitActionType: payload.benefitActionType,
        hasBenefitActionLink: Boolean(payload.benefitActionLink),
      },
    });
  }
  revalidatePartnerData();
  revalidateAdminAndPublicPaths(id);
  redirect(getUpdatedPartnerRedirectPath(redirectPath));
}
