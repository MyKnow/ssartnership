"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  DEFAULT_PROMOTION_AUDIENCES,
  type PromotionAudience,
} from "@/lib/promotions/catalog";
import { getEventPageDefinition } from "@/lib/event-pages";
import {
  deletePromotionSlideImageUrls,
  uploadPromotionSlideImageFile,
} from "@/lib/promotion-slide-storage-server";
import { logAdminAction } from "./shared-helpers";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function getRequiredString(formData: FormData, key: string) {
  const value = getString(formData, key);
  if (!value) {
    throw new Error("필수 입력값을 확인해 주세요.");
  }
  return value;
}

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

function parseDateTimeLocal(value: string) {
  if (!value) {
    throw new Error("이벤트 기간을 입력해 주세요.");
  }
  const normalized = value.length === 16 ? `${value}:00+09:00` : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    throw new Error("이벤트 기간 형식을 확인해 주세요.");
  }
  return date.toISOString();
}

function revalidatePromotionPaths(slug: string) {
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/advertisement");
  revalidatePath("/admin/event");
  revalidatePath("/admin/event/[slug]", "page");
  revalidatePath("/admin/promotions");
  revalidatePath("/events/[slug]", "page");
  revalidatePath(`/events/${slug}`);
}

function parseTargetAudiences(formData: FormData) {
  const values = formData.getAll("targetAudiences");
  const audiences = normalizeAudienceArray(values);
  if (audiences.length === 0) {
    throw new Error("이벤트 대상은 최소 1개 이상 선택해 주세요.");
  }
  return audiences;
}

function parsePromotionEventRegistration(formData: FormData, slug: string) {
  const normalizedSlug = normalizeSlug(slug);
  if (!normalizedSlug || normalizedSlug !== slug) {
    throw new Error("이벤트 슬러그를 확인해 주세요.");
  }

  const definition = getEventPageDefinition(slug);
  if (!definition) {
    throw new Error("등록 가능한 이벤트 페이지를 찾지 못했습니다.");
  }

  const startsAt = parseDateTimeLocal(getRequiredString(formData, "startsAt"));
  const endsAt = parseDateTimeLocal(getRequiredString(formData, "endsAt"));
  if (new Date(startsAt).getTime() > new Date(endsAt).getTime()) {
    throw new Error("이벤트 시작 시각은 종료 시각보다 늦을 수 없습니다.");
  }

  return {
    slug,
    page_path: `/events/${slug}`,
    target_audiences: parseTargetAudiences(formData),
    starts_at: startsAt,
    ends_at: endsAt,
    is_active: formData.get("isActive") === "on",
    title: definition.title,
    short_title: definition.shortTitle,
    description: definition.description,
    period_label: definition.periodLabel,
    hero_image_src: definition.heroImageSrc,
    hero_image_alt: definition.heroImageAlt,
    conditions: definition.conditions,
    rules: definition.rules,
  };
}

function parsePromotionSlidePayload(formData: FormData) {
  return {
    title: getRequiredString(formData, "title"),
    subtitle: getRequiredString(formData, "subtitle"),
    image_src: getString(formData, "imageSrc"),
    image_alt: getRequiredString(formData, "imageAlt"),
    href: getRequiredString(formData, "href"),
    is_active: formData.get("isActive") === "on",
  };
}

type PromotionSlideDraftPayload = {
  id: string;
  title: string;
  subtitle: string;
  imageSrc: string;
  imageAlt: string;
  href: string;
  isActive: boolean;
  audiences: PromotionAudience[];
  allowedCampuses: string[];
};

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function normalizeAudienceArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  const valid = new Set<PromotionAudience>(DEFAULT_PROMOTION_AUDIENCES);
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item): item is PromotionAudience => valid.has(item as PromotionAudience));
}

function normalizePromotionAudiences(value: unknown) {
  const audiences = normalizeAudienceArray(value);
  return audiences.length > 0 ? audiences : [...DEFAULT_PROMOTION_AUDIENCES];
}

function parsePromotionSlideDrafts(formData: FormData) {
  const raw = getRequiredString(formData, "slidesJson");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("광고 카드 데이터를 불러올 수 없습니다.");
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("최소 1개의 광고 카드가 필요합니다.");
  }

  const slides = parsed.map((item): PromotionSlideDraftPayload => {
    if (!item || typeof item !== "object") {
      throw new Error("광고 카드 데이터를 확인해 주세요.");
    }
    const record = item as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id.trim() : "";
    if (!id) {
      throw new Error("광고 카드 식별자가 필요합니다.");
    }
    return {
      id,
      title: typeof record.title === "string" ? record.title.trim() : "",
      subtitle: typeof record.subtitle === "string" ? record.subtitle.trim() : "",
      imageSrc: typeof record.imageSrc === "string" ? record.imageSrc.trim() : "",
      imageAlt: typeof record.imageAlt === "string" ? record.imageAlt.trim() : "",
      href: typeof record.href === "string" ? record.href.trim() : "",
      isActive: record.isActive === true,
      audiences: normalizePromotionAudiences(record.audiences),
      allowedCampuses: normalizeStringArray(record.allowedCampuses),
    };
  });
  const ids = new Set(slides.map((slide) => slide.id));
  if (ids.size !== slides.length) {
    throw new Error("광고 카드 식별자가 중복되었습니다.");
  }
  return slides;
}

async function maybeUploadPromotionSlideImage(formData: FormData, existingIndex: number) {
  const value = formData.get("imageFile");
  if (!(value instanceof File) || value.size === 0) {
    return null;
  }
  return uploadPromotionSlideImageFile(value, existingIndex);
}

async function getNextPromotionSlideOrder() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("promotion_slides")
    .select("display_order")
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  const current = typeof data?.display_order === "number" ? data.display_order : 0;
  return current + 1;
}

async function swapPromotionSlideOrder(id: string, direction: -1 | 1) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("promotion_slides")
    .select("id,display_order")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    throw new Error(error.message);
  }
  const slides = (data ?? []) as Array<{ id: string; display_order: number }>;
  const index = slides.findIndex((slide) => slide.id === id);
  if (index < 0) {
    throw new Error("이동할 카드를 찾지 못했습니다.");
  }
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= slides.length) {
    return;
  }
  const currentSlide = slides[index];
  const targetSlide = slides[targetIndex];
  const currentOrder = currentSlide?.display_order;
  const targetOrder = targetSlide?.display_order;
  if (typeof currentOrder !== "number" || typeof targetOrder !== "number") {
    throw new Error("카드 순번을 확인할 수 없습니다.");
  }
  const { error: currentError } = await supabase
    .from("promotion_slides")
    .update({ display_order: targetOrder })
    .eq("id", currentSlide.id);
  if (currentError) {
    throw new Error(currentError.message);
  }
  const { error: targetError } = await supabase
    .from("promotion_slides")
    .update({ display_order: currentOrder })
    .eq("id", targetSlide.id);
  if (targetError) {
    throw new Error(targetError.message);
  }
  return { fromOrder: currentOrder, toOrder: targetOrder };
}

function revalidateAdvertisementPaths() {
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/advertisement");
  revalidatePath("/admin/promotions");
}

export async function createPromotionEventAction(formData: FormData) {
  await requireAdmin();
  const slug = normalizeSlug(getRequiredString(formData, "slug"));
  const payload = parsePromotionEventRegistration(formData, slug);
  const supabase = getSupabaseAdminClient();
  const { data: existing, error: existingError } = await supabase
    .from("promotion_events")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (existingError) {
    throw new Error(existingError.message);
  }
  if (existing) {
    throw new Error("이미 등록된 이벤트입니다.");
  }
  const { error } = await supabase.from("promotion_events").insert(payload);
  if (error) {
    throw new Error(error.message);
  }
  await logAdminAction("promotion_event_create", {
    targetType: "promotion_event",
    targetId: payload.slug,
    properties: {
      slug: payload.slug,
      pagePath: payload.page_path,
      targetAudiences: payload.target_audiences,
    },
  });
  revalidatePromotionPaths(payload.slug);
  redirect(`/admin/event/${payload.slug}?status=created`);
}

export async function updatePromotionEventAction(formData: FormData) {
  await requireAdmin();
  const id = getRequiredString(formData, "id");
  const supabase = getSupabaseAdminClient();
  const { data: existing, error: existingError } = await supabase
    .from("promotion_events")
    .select("slug")
    .eq("id", id)
    .maybeSingle();
  if (existingError) {
    throw new Error(existingError.message);
  }
  if (!existing?.slug) {
    throw new Error("이벤트를 찾지 못했습니다.");
  }
  const payload = parsePromotionEventRegistration(formData, existing.slug);
  const { error } = await supabase.from("promotion_events").update(payload).eq("id", id);
  if (error) {
    throw new Error(error.message);
  }
  await logAdminAction("promotion_event_update", {
    targetType: "promotion_event",
    targetId: id,
    properties: {
      slug: payload.slug,
      pagePath: payload.page_path,
      targetAudiences: payload.target_audiences,
    },
  });
  revalidatePromotionPaths(payload.slug);
  redirect(`/admin/event/${payload.slug}?status=updated`);
}

export async function deletePromotionEventAction(formData: FormData) {
  await requireAdmin();
  const id = getRequiredString(formData, "id");
  const slug = getString(formData, "slug") || id;
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("promotion_events").delete().eq("id", id);
  if (error) {
    throw new Error(error.message);
  }
  await logAdminAction("promotion_event_delete", {
    targetType: "promotion_event",
    targetId: id,
    properties: { slug },
  });
  revalidatePromotionPaths(slug);
  redirect("/admin/event?status=deleted");
}

export async function createPromotionSlideAction(formData: FormData) {
  await requireAdmin();
  const payload = parsePromotionSlidePayload(formData);
  const displayOrder = await getNextPromotionSlideOrder();
  const uploadedImageSrc = await maybeUploadPromotionSlideImage(formData, displayOrder);
  if (!uploadedImageSrc && !payload.image_src) {
    throw new Error("카드 이미지를 업로드하거나 이미지 URL을 입력해 주세요.");
  }
  const finalPayload = {
    ...payload,
    display_order: displayOrder,
    image_src: uploadedImageSrc ?? payload.image_src,
  };
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("promotion_slides").insert(finalPayload);
  if (error) {
    throw new Error(error.message);
  }
  await logAdminAction("promotion_slide_create", {
    targetType: "promotion_slide",
    targetId: finalPayload.href,
    properties: { title: finalPayload.title, href: finalPayload.href, imageSrc: finalPayload.image_src },
  });
  revalidateAdvertisementPaths();
  redirect("/admin/advertisement?status=created");
}

export async function updatePromotionSlideAction(formData: FormData) {
  await requireAdmin();
  const id = getRequiredString(formData, "id");
  const payload = parsePromotionSlidePayload(formData);
  const supabase = getSupabaseAdminClient();
  const { data: existing, error: existingError } = await supabase
    .from("promotion_slides")
    .select("image_src,display_order")
    .eq("id", id)
    .maybeSingle();
  if (existingError) {
    throw new Error(existingError.message);
  }
  const uploadedImageSrc = await maybeUploadPromotionSlideImage(
    formData,
    typeof existing?.display_order === "number" ? existing.display_order : 0,
  );
  if (!uploadedImageSrc && !payload.image_src) {
    throw new Error("카드 이미지를 업로드하거나 이미지 URL을 입력해 주세요.");
  }
  const finalPayload = {
    ...payload,
    image_src: uploadedImageSrc ?? payload.image_src,
  };
  const { error } = await supabase.from("promotion_slides").update(finalPayload).eq("id", id);
  if (error) {
    throw new Error(error.message);
  }
  await logAdminAction("promotion_slide_update", {
    targetType: "promotion_slide",
    targetId: id,
    properties: { title: finalPayload.title, href: finalPayload.href, imageSrc: finalPayload.image_src },
  });
  if (existing?.image_src && existing.image_src !== finalPayload.image_src) {
    await deletePromotionSlideImageUrls([existing.image_src]);
  }
  revalidateAdvertisementPaths();
  redirect("/admin/advertisement?status=updated");
}

export async function movePromotionSlideAction(formData: FormData) {
  await requireAdmin();
  const id = getRequiredString(formData, "id");
  const directionRaw = getRequiredString(formData, "direction");
  const direction = directionRaw === "up" ? -1 : directionRaw === "down" ? 1 : 0;
  if (direction === 0) {
    throw new Error("이동 방향을 확인해 주세요.");
  }
  const moved = await swapPromotionSlideOrder(id, direction);
  if (!moved) {
    revalidateAdvertisementPaths();
    redirect("/admin/advertisement?status=updated");
  }
  await logAdminAction("promotion_slide_update", {
    targetType: "promotion_slide",
    targetId: id,
    properties: { direction, fromOrder: moved.fromOrder, toOrder: moved.toOrder },
  });
  revalidateAdvertisementPaths();
  redirect("/admin/advertisement?status=updated");
}

export async function deletePromotionSlideAction(formData: FormData) {
  await requireAdmin();
  const id = getRequiredString(formData, "id");
  const title = getString(formData, "title");
  const supabase = getSupabaseAdminClient();
  const { data: existing, error: existingError } = await supabase
    .from("promotion_slides")
    .select("image_src")
    .eq("id", id)
    .maybeSingle();
  if (existingError) {
    throw new Error(existingError.message);
  }
  const { error } = await supabase.from("promotion_slides").delete().eq("id", id);
  if (error) {
    throw new Error(error.message);
  }
  await logAdminAction("promotion_slide_delete", {
    targetType: "promotion_slide",
    targetId: id,
    properties: { title },
  });
  if (existing?.image_src) {
    await deletePromotionSlideImageUrls([existing.image_src]);
  }
  revalidateAdvertisementPaths();
  redirect("/admin/advertisement?status=deleted");
}

export async function savePromotionSlidesAction(formData: FormData) {
  await requireAdmin();
  const slides = parsePromotionSlideDrafts(formData);
  const supabase = getSupabaseAdminClient();

  const { data: existingRows, error: existingError } = await supabase
    .from("promotion_slides")
    .select("id,image_src")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (existingError) {
    throw new Error(existingError.message);
  }

  const existingMap = new Map<string, { id: string; image_src: string | null }>(
    ((existingRows ?? []) as Array<{ id: string; image_src: string | null }>).map((row) => [
      row.id,
      row,
    ]),
  );

  const keepIds = new Set<string>();
  const nextRows: Array<{
    id: string;
    display_order: number;
    title: string;
    subtitle: string;
    image_src: string;
    image_alt: string;
    href: string;
    is_active: boolean;
    audiences: PromotionAudience[];
    allowed_campuses: string[];
  }> = [];
  const removedImageUrls = new Set<string>();
  const nextImageUrls = new Set<string>();

  for (const [index, slide] of slides.entries()) {
    const fileKey = `slide_image_${slide.id}`;
    const fileValue = formData.get(fileKey);
    const file = fileValue instanceof File && fileValue.size > 0 ? fileValue : null;
    const existing = existingMap.get(slide.id);
    const isExistingSlide = Boolean(existing);

    if (!slide.title || !slide.subtitle || !slide.href || !slide.imageAlt) {
      throw new Error("광고 카드의 제목, 부제, 이미지 대체 텍스트, 연결 페이지를 모두 입력해 주세요.");
    }
    if (slide.audiences.length === 0) {
      throw new Error("광고 카드의 노출 대상을 하나 이상 선택해 주세요.");
    }
    if (!isExistingSlide && !file) {
      throw new Error("새 광고 카드는 이미지를 업로드해 주세요.");
    }

    let imageSrc = slide.imageSrc;
    if (file) {
      imageSrc = await uploadPromotionSlideImageFile(file, index + 1);
    }
    if (!imageSrc) {
      throw new Error("광고 카드 이미지를 업로드해 주세요.");
    }

    nextRows.push({
      id: slide.id,
      display_order: index + 1,
      title: slide.title,
      subtitle: slide.subtitle,
      image_src: imageSrc,
      image_alt: slide.imageAlt,
      href: slide.href,
      is_active: slide.isActive,
      audiences: slide.audiences,
      allowed_campuses: slide.allowedCampuses,
    });
    keepIds.add(slide.id);
    nextImageUrls.add(imageSrc);

    if (existing?.image_src && existing.image_src !== imageSrc) {
      removedImageUrls.add(existing.image_src);
    }
  }

  const removedRows = [...existingMap.values()].filter((row) => !keepIds.has(row.id));
  for (const row of removedRows) {
    if (row.image_src && !nextImageUrls.has(row.image_src)) {
      removedImageUrls.add(row.image_src);
    }
  }

  const { error: upsertError } = await supabase
    .from("promotion_slides")
    .upsert(nextRows, { onConflict: "id" });
  if (upsertError) {
    throw new Error(upsertError.message);
  }

  if (removedRows.length > 0) {
    const { error: deleteError } = await supabase
      .from("promotion_slides")
      .delete()
      .in(
        "id",
        removedRows.map((row) => row.id),
      );
    if (deleteError) {
      throw new Error(deleteError.message);
    }
  }

  if (removedImageUrls.size > 0) {
    await deletePromotionSlideImageUrls(Array.from(removedImageUrls));
  }

  await logAdminAction("promotion_slide_bulk_update", {
    targetType: "promotion_slide",
    targetId: "bulk",
    properties: {
      count: nextRows.length,
      removedCount: removedRows.length,
    },
  });

  revalidateAdvertisementPaths();
  redirect("/admin/advertisement?status=updated");
}
