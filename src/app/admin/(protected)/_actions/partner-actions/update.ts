import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { buildAuditChangeSummary } from "@/lib/audit-change-summary";
import { deletePartnerMediaUrls } from "@/lib/partner-media-storage";
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

function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function updatePartnerAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "").trim();
  if (!id) {
    throw new Error("수정할 업체를 찾을 수 없습니다.");
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
      "company_id,category_id,name,location,campus_slugs,map_url,benefit_action_type,benefit_action_link,reservation_link,inquiry_link,period_start,period_end,conditions,benefits,applies_to,thumbnail,images,tags,visibility,benefit_visibility,company:partner_companies(id,name,slug),categories(id,label)",
    )
    .eq("id", id)
    .maybeSingle();

  if (previousPartnerError) {
    throw new Error(previousPartnerError.message);
  }
  if (!previousPartner) {
    throw new Error("수정할 업체를 찾을 수 없습니다.");
  }

  const previousCompany = normalizeRelation<{
    id: string;
    name: string;
    slug: string;
  }>((previousPartner as { company?: unknown }).company as
    | {
        id: string;
        name: string;
        slug: string;
      }
    | Array<{
        id: string;
        name: string;
        slug: string;
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
  const media = await resolvePartnerMediaPayload(formData, id);
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
    );
    if (companyProvision.company) {
      nextCompanyId = companyProvision.company.id;
    }
  }

  try {
    const { error } = await supabase
      .from("partners")
      .update({
        company_id: nextCompanyId,
        name: payload.name,
        category_id: payload.categoryId,
        location: payload.location,
        campus_slugs: payload.campusSlugs,
        map_url: payload.mapUrl,
        benefit_action_type: payload.benefitActionType,
        benefit_action_link: payload.benefitActionLink,
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
      .eq("id", id);

    if (error) {
      throw new Error(error.message);
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
  const partnerAudit = buildAuditChangeSummary("브랜드", [
    {
      label: "회사 연결",
      before: previousCompanyLabel,
      after: nextCompanyLabel,
    },
    {
      label: "브랜드명",
      before: previousPartner.name ?? "",
      after: payload.name,
    },
    {
      label: "카테고리",
      before: previousCategory?.label ?? payload.categoryId,
      after: nextCategoryLabel,
    },
    {
      label: "위치",
      before: previousPartner.location ?? "",
      after: payload.location,
    },
    {
      label: "노출 캠퍼스",
      before: previousPartner.campus_slugs ?? [],
      after: payload.campusSlugs,
    },
    {
      label: "지도 링크",
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
  redirect(redirectPath);
}
