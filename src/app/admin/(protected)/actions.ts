"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { getServerActionLogContext, logAdminAudit } from "@/lib/activity-logs";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { isWithinPeriod } from "@/lib/partner-utils";
import { createNewPartnerPayload, isPushConfigured, sendPushToAudience } from "@/lib/push";
import { clearAdminSession, requireAdmin } from "@/lib/auth";
import type { PartnerVisibility } from "@/lib/types";
import {
  buildMemberSyncLogProperties,
  syncMembersBySelectableYears,
} from "@/lib/mm-member-sync";
import {
  isPartnerVisibility,
  normalizePartnerVisibility,
} from "@/lib/partner-visibility";
import {
  sanitizeHexColor,
  sanitizeHttpUrl,
  sanitizePartnerLinkValue,
  parseSsafyYearValue,
  validateCategoryKey,
  validateSsafyYear,
  validateDateRange,
} from "@/lib/validation";

type PartnerInput = {
  name: string;
  categoryId: string;
  location: string;
  mapUrl: string | null;
  reservationLink: string | null;
  inquiryLink: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  benefits: string[];
  conditions: string[];
  images: string[];
  tags: string[];
  visibility: PartnerVisibility;
};

function parseList(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function parseMultiLine(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function parseOptionalUrl(value: string) {
  return sanitizeHttpUrl(value) ?? null;
}

function parsePartnerLink(value: string) {
  return sanitizePartnerLinkValue(value) ?? null;
}

async function logAdminAction(
  action: Parameters<typeof logAdminAudit>[0]["action"],
  input?: {
    targetType?: string | null;
    targetId?: string | null;
    properties?: Record<string, unknown> | null;
  },
) {
  const context = await getServerActionLogContext("/admin");
  await logAdminAudit({
    ...context,
    action,
    targetType: input?.targetType ?? null,
    targetId: input?.targetId ?? null,
    properties: input?.properties ?? {},
  });
}

function revalidateAdminAndPublicPaths(partnerId?: string) {
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/partners/[id]", "page");
  if (partnerId) {
    revalidatePath(`/partners/${partnerId}`);
  }
}

function revalidateCategoryData() {
  revalidateTag("categories", "max");
}

function revalidatePartnerData() {
  revalidateTag("partners", "max");
}

function revalidateMemberPaths() {
  revalidatePath("/admin");
  revalidatePath("/admin/members");
  revalidatePath("/admin/partners");
  revalidatePath("/certification");
  revalidatePath("/auth/change-password");
}

function parseCategoryPayload(formData: FormData) {
  const key = String(formData.get("key") || "")
    .trim()
    .toLowerCase();
  const label = String(formData.get("label") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const rawColor = String(formData.get("color") || "").trim();

  if (!key || !label) {
    throw new Error("카테고리 키와 라벨을 입력해 주세요.");
  }

  const keyError = validateCategoryKey(key);
  if (keyError) {
    throw new Error(keyError);
  }

  const color = rawColor ? sanitizeHexColor(rawColor) : null;
  if (rawColor && !color) {
    throw new Error("카테고리 색상은 #RRGGBB 형식이어야 합니다.");
  }

  return {
    key,
    label,
    description,
    color,
  };
}

function parsePartnerPayload(formData: FormData): PartnerInput {
  const name = String(formData.get("name") || "").trim();
  const categoryId = String(formData.get("categoryId") || "").trim();
  const location = String(formData.get("location") || "").trim();
  const rawMapUrl = String(formData.get("mapUrl") || "").trim();
  const rawReservationLink = String(formData.get("reservationLink") || "").trim();
  const rawInquiryLink = String(formData.get("inquiryLink") || "").trim();
  const rawVisibility = String(formData.get("visibility") || "").trim();
  const periodStart = String(formData.get("periodStart") || "").trim();
  const periodEnd = String(formData.get("periodEnd") || "").trim();
  const benefits = String(formData.get("benefits") || "").trim();
  const conditions = String(formData.get("conditions") || "").trim();
  const images = String(formData.get("images") || "").trim();
  const tags = String(formData.get("tags") || "").trim();

  if (!name || !categoryId || !location) {
    throw new Error("업체명, 카테고리, 위치를 입력해 주세요.");
  }

  const dateRangeError = validateDateRange(periodStart, periodEnd);
  if (dateRangeError) {
    throw new Error(dateRangeError);
  }

  const mapUrl = parseOptionalUrl(rawMapUrl);
  if (rawMapUrl && !mapUrl) {
    throw new Error("지도 링크는 올바른 http(s) 주소여야 합니다.");
  }

  const reservationLink = parsePartnerLink(rawReservationLink);
  if (rawReservationLink && !reservationLink) {
    throw new Error("예약 링크 형식을 확인해 주세요.");
  }

  const inquiryLink = parsePartnerLink(rawInquiryLink);
  if (rawInquiryLink && !inquiryLink) {
    throw new Error("문의 링크 형식을 확인해 주세요.");
  }

  if (rawVisibility && !isPartnerVisibility(rawVisibility)) {
    throw new Error("노출 상태는 공개, 대외비, 비공개 중 하나여야 합니다.");
  }
  const visibility = normalizePartnerVisibility(rawVisibility || "public");

  const rawImageUrls = parseMultiLine(images);
  const sanitizedImages = rawImageUrls
    .map((item) => sanitizeHttpUrl(item))
    .filter((item): item is string => Boolean(item));
  if (rawImageUrls.length !== sanitizedImages.length) {
    throw new Error("이미지 URL 형식을 확인해 주세요.");
  }

  return {
    name,
    categoryId,
    location,
    mapUrl,
    reservationLink,
    inquiryLink,
    periodStart: periodStart || null,
    periodEnd: periodEnd || null,
    benefits: parseList(benefits),
    conditions: parseList(conditions),
    images: sanitizedImages,
    tags: parseList(tags),
    visibility,
  };
}

export async function createCategory(formData: FormData) {
  await requireAdmin();
  const { key, label, description, color } = parseCategoryPayload(formData);

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("categories")
    .insert({ key, label, description, color })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction("category_create", {
    targetType: "category",
    targetId: data?.id ?? null,
    properties: { key, label, description, color },
  });
  revalidateCategoryData();
  revalidateAdminAndPublicPaths();
}

export async function updateCategory(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "").trim();
  const { key, label, description, color } = parseCategoryPayload(formData);

  if (!id) {
    throw new Error("수정할 카테고리를 찾을 수 없습니다.");
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("categories")
    .update({ key, label, description, color })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction("category_update", {
    targetType: "category",
    targetId: id,
    properties: { key, label, description, color },
  });
  revalidateCategoryData();
  revalidateAdminAndPublicPaths();
  redirect("/admin/partners");
}

export async function deleteCategory(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "").trim();
  if (!id) {
    throw new Error("삭제할 카테고리를 찾을 수 없습니다.");
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("categories").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction("category_delete", {
    targetType: "category",
    targetId: id,
  });
  revalidateCategoryData();
  revalidateAdminAndPublicPaths();
}

export async function createPartner(formData: FormData) {
  await requireAdmin();
  const payload = parsePartnerPayload(formData);

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("partners")
    .insert({
      name: payload.name,
      category_id: payload.categoryId,
      location: payload.location,
      map_url: payload.mapUrl,
      reservation_link: payload.reservationLink,
      inquiry_link: payload.inquiryLink,
      period_start: payload.periodStart,
      period_end: payload.periodEnd,
      benefits: payload.benefits,
      conditions: payload.conditions,
      images: payload.images,
      tags: payload.tags,
      visibility: payload.visibility,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction("partner_create", {
    targetType: "partner",
    targetId: data?.id ?? null,
    properties: {
      name: payload.name,
      categoryId: payload.categoryId,
      location: payload.location,
      hasMapUrl: Boolean(payload.mapUrl),
      hasReservationLink: Boolean(payload.reservationLink),
      hasInquiryLink: Boolean(payload.inquiryLink),
      periodStart: payload.periodStart,
      periodEnd: payload.periodEnd,
      visibility: payload.visibility,
      benefitCount: payload.benefits.length,
      conditionCount: payload.conditions.length,
      imageCount: payload.images.length,
      tagCount: payload.tags.length,
    },
  });

  if (
    data?.id &&
    payload.visibility !== "private" &&
    isPushConfigured() &&
    isWithinPeriod(payload.periodStart, payload.periodEnd)
  ) {
    const { data: category } = await supabase
      .from("categories")
      .select("label")
      .eq("id", payload.categoryId)
      .maybeSingle();

    try {
      await sendPushToAudience(
        createNewPartnerPayload({
          partnerId: data.id,
          name: payload.name,
          location: payload.location,
          categoryLabel: category?.label ?? null,
        }),
      );
    } catch (pushError) {
      console.error("new partner push failed", pushError);
    }
  }

  revalidatePartnerData();
  revalidateAdminAndPublicPaths(data?.id);
}

export async function updatePartner(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "").trim();
  const payload = parsePartnerPayload(formData);

  if (!id) {
    throw new Error("수정할 업체를 찾을 수 없습니다.");
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("partners")
    .update({
      name: payload.name,
      category_id: payload.categoryId,
      location: payload.location,
      map_url: payload.mapUrl,
      reservation_link: payload.reservationLink,
      inquiry_link: payload.inquiryLink,
      period_start: payload.periodStart,
      period_end: payload.periodEnd,
      benefits: payload.benefits,
      conditions: payload.conditions,
      images: payload.images,
      tags: payload.tags,
      visibility: payload.visibility,
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction("partner_update", {
    targetType: "partner",
    targetId: id,
    properties: {
      name: payload.name,
      categoryId: payload.categoryId,
      location: payload.location,
      hasMapUrl: Boolean(payload.mapUrl),
      hasReservationLink: Boolean(payload.reservationLink),
      hasInquiryLink: Boolean(payload.inquiryLink),
      periodStart: payload.periodStart,
      periodEnd: payload.periodEnd,
      visibility: payload.visibility,
      benefitCount: payload.benefits.length,
      conditionCount: payload.conditions.length,
      imageCount: payload.images.length,
      tagCount: payload.tags.length,
    },
  });
  revalidatePartnerData();
  revalidateAdminAndPublicPaths(id);
  redirect("/admin/partners");
}

export async function deletePartner(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "").trim();
  if (!id) {
    throw new Error("삭제할 업체를 찾을 수 없습니다.");
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("partners").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction("partner_delete", {
    targetType: "partner",
    targetId: id,
  });
  revalidatePartnerData();
  revalidateAdminAndPublicPaths(id);
}

export async function backfillMemberProfiles() {
  await requireAdmin();

  const context = await getServerActionLogContext("/admin/members");
  let status = "success";
  let summary = {
    checked: 0,
    updated: 0,
    skipped: 0,
    failures: 0,
  };

  try {
    const result = await syncMembersBySelectableYears();
    const actorId = process.env.ADMIN_ID ?? "admin";
    summary = {
      checked: result.checked,
      updated: result.updated,
      skipped: result.skipped,
      failures: result.failures.length,
    };

    for (const syncResult of result.results) {
      await logAdminAudit({
        ...context,
        action: "member_sync",
        actorId,
        targetType: "member",
        targetId: syncResult.member.id,
        properties: buildMemberSyncLogProperties(syncResult, {
          source: "manual_backfill",
        }),
      });
    }
    status = result.failures.length > 0 ? "partial" : "success";
  } catch (error) {
    console.error("member backfill failed", error);
    status = "error";
  }

  revalidateMemberPaths();
  if (status === "error") {
    redirect("/admin/members?backfill=error");
  }

  redirect(
    `/admin/members?backfill=${status}&checked=${summary.checked}&updated=${summary.updated}&skipped=${summary.skipped}&failures=${summary.failures}`,
  );
}

export async function updateMember(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "").trim();
  const displayName = String(formData.get("displayName") || "").trim();
  const yearRaw = String(formData.get("year") || "").trim();
  const campus = String(formData.get("campus") || "").trim();
  const classNumberRaw = String(formData.get("classNumber") || "").trim();
  const mustChangePassword =
    String(formData.get("mustChangePassword") || "false").trim() === "true";

  if (!id) {
    throw new Error("수정할 회원을 찾을 수 없습니다.");
  }

  const yearError = validateSsafyYear(yearRaw);
  const year = parseSsafyYearValue(yearRaw);
  if (yearError || year === null) {
    throw new Error("기수는 1~99 사이의 숫자로 입력해 주세요.");
  }

  let classNumber: number | null = null;
  if (classNumberRaw) {
    classNumber = Number.parseInt(classNumberRaw, 10);
    if (!Number.isInteger(classNumber) || classNumber < 1 || classNumber > 30) {
      throw new Error("반 정보는 1~30 사이의 숫자로 입력해 주세요.");
    }
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("members")
    .update({
      display_name: displayName || null,
      year,
      campus: campus || null,
      class_number: classNumber,
      must_change_password: mustChangePassword,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction("member_update", {
    targetType: "member",
    targetId: id,
    properties: {
      displayName,
      year,
      campus,
      classNumber,
      mustChangePassword,
    },
  });
  revalidateMemberPaths();
  redirect("/admin/members");
}

export async function deleteMember(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "").trim();

  if (!id) {
    throw new Error("삭제할 회원을 찾을 수 없습니다.");
  }

  const supabase = getSupabaseAdminClient();
  const { data: member, error: memberError } = await supabase
    .from("members")
    .select("mm_user_id,mm_username")
    .eq("id", id)
    .maybeSingle();

  if (memberError) {
    throw new Error(memberError.message);
  }
  if (!member?.mm_user_id && !member?.mm_username) {
    throw new Error("삭제할 회원을 찾을 수 없습니다.");
  }

  if (member.mm_user_id) {
    await supabase
      .from("mm_verification_codes")
      .delete()
      .eq("mm_user_id", member.mm_user_id);
    await supabase
      .from("mm_verification_attempts")
      .delete()
      .eq("identifier", member.mm_user_id);
    await supabase
      .from("password_reset_attempts")
      .delete()
      .eq("identifier", member.mm_user_id);
  }
  if (member.mm_username && member.mm_username !== member.mm_user_id) {
    await supabase
      .from("mm_verification_codes")
      .delete()
      .eq("mm_username", member.mm_username);
    await supabase
      .from("mm_verification_attempts")
      .delete()
      .eq("identifier", member.mm_username);
    await supabase
      .from("password_reset_attempts")
      .delete()
      .eq("identifier", member.mm_username);
  }

  const { error } = await supabase.from("members").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction("member_delete", {
    targetType: "member",
    targetId: id,
    properties: {
      mmUserId: member.mm_user_id,
      mmUsername: member.mm_username,
    },
  });
  revalidateMemberPaths();
}

export async function logout() {
  await logAdminAction("logout");
  await clearAdminSession();
  redirect("/admin/login");
}
