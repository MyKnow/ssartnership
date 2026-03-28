"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { clearAdminSession, requireAdmin } from "@/lib/auth";
import {
  sanitizeHexColor,
  sanitizeHttpUrl,
  sanitizePartnerLinkValue,
  validateCategoryKey,
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

function revalidateAdminAndPublicPaths(partnerId?: string) {
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/partners/[id]", "page");
  if (partnerId) {
    revalidatePath(`/partners/${partnerId}`);
  }
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
  };
}

export async function createCategory(formData: FormData) {
  await requireAdmin();
  const { key, label, description, color } = parseCategoryPayload(formData);

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("categories")
    .insert({ key, label, description, color });

  if (error) {
    throw new Error(error.message);
  }

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

  revalidateAdminAndPublicPaths();
  redirect("/admin");
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
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

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
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidateAdminAndPublicPaths(id);
  redirect("/admin");
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

  revalidateAdminAndPublicPaths(id);
}

export async function logout() {
  await clearAdminSession();
  redirect("/admin/login");
}
