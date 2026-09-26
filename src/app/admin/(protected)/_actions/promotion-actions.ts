"use server";

import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import { getAdminSession } from "@/lib/auth";
import { requireAdminPermission } from "@/lib/admin-access";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getSafeAdminActionErrorCode } from "@/lib/admin-action-errors";
import { AD_PACKAGE_FORM_LIMITS } from "@/lib/ad-package-validation";
import {
  DEFAULT_PROMOTION_AUDIENCES,
  type PromotionAudience,
} from "@/lib/promotions/catalog";
import { assertPromotionSlideImageSource } from "@/lib/promotions/image-source";
import {
  PromotionSlideSaveError,
  validatePromotionSlide,
} from "@/lib/promotions/slide-validation";
import { getEventPageDefinition } from "@/lib/event-pages";
import {
  createStoredEventRewardDraw,
  parseEventRewardDrawPreviewRequest,
  parseEventRewardDrawRequest,
  sendEventRewardWinnerTestNotification,
  sendEventRewardWinnerNotifications,
} from "@/lib/promotions/event-rewards";
import {
  getManagedEventCampaign,
  PROMOTION_EVENTS_CACHE_TAG,
  PROMOTION_SLIDES_CACHE_TAG,
} from "@/lib/promotions/events";
import {
  deletePromotionSlideImageUrls,
} from "@/lib/promotion-slide-storage-server";
import { resolveImageUploadActorForServerAction } from "@/lib/image-upload/auth.server";
import { resolveImageTransformPolicy } from "@/lib/image-upload/policy";
import { getImageUploadRepository } from "@/lib/image-upload/repository.server";
import { PROMOTION_SLIDES_BUCKET } from "@/lib/promotion-slide-storage";
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

function eventRewardActionSlug(formData: FormData) {
  return normalizeSlug(getString(formData, "slug")) || "signup-reward";
}

function eventRewardActionErrorMessage(_error: unknown, fallback: string) {
  return fallback;
}

function adminEventUrl(
  slug: string,
  entries: Record<string, string | number | null | undefined>,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(entries)) {
    const stringValue = String(value ?? "").trim();
    if (stringValue) {
      params.set(key, stringValue);
    }
  }
  const query = params.toString();
  return `/admin/event/${slug}${query ? `?${query}` : ""}`;
}

function redirectEventRegistrationError(slug: string, fallback: string, error?: unknown): never {
  const safeSlug = normalizeSlug(slug);
  const path = safeSlug ? `/admin/event/${encodeURIComponent(safeSlug)}` : "/admin/event";
  const code = error
    ? getSafeAdminActionErrorCode(error, fallback)
    : fallback;
  redirect(`${path}?error=${encodeURIComponent(code)}`);
}

function redirectAdvertisementError(fallback: string, error?: unknown): never {
  const code = error
    ? getSafeAdminActionErrorCode(error, fallback)
    : fallback;
  const params = new URLSearchParams({ error: code });
  if (error instanceof PromotionSlideSaveError && error.slideNumber) {
    params.set("slide", String(error.slideNumber));
  }
  redirect(`/admin/advertisement?${params.toString()}`);
}

function redirectEventRewardDrawError(params: {
  slug: string;
  message: string;
  winnerCount?: string;
  seed?: string;
}): never {
  redirect(
    adminEventUrl(params.slug, {
      status: "draw-error",
      drawError: params.message,
      drawWinnerCount: params.winnerCount,
      drawSeed: params.seed,
    }),
  );
}

function redirectEventRewardDrawPreviewError(params: {
  slug: string;
  message: string;
  winnerCount?: string;
  seed?: string;
}): never {
  redirect(
    adminEventUrl(params.slug, {
      status: "draw-preview-error",
      previewError: params.message,
      previewWinnerCount: params.winnerCount,
      previewSeed: params.seed,
    }),
  );
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
  revalidateTag(PROMOTION_EVENTS_CACHE_TAG, "max");
  revalidateTag(PROMOTION_SLIDES_CACHE_TAG, "max");
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
  eventSlug: string | null;
  adCampaignId: string | null;
  sponsorLabel: string;
  uploadId: string | null;
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

function extractEventSlugFromHref(href: string) {
  const match = href.match(/^\/events\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:[/?#]|$)/);
  return match?.[1] ?? null;
}

function parsePromotionSlideDrafts(formData: FormData) {
  const raw = getString(formData, "slidesJson");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new PromotionSlideSaveError("promotion_slide_payload_invalid");
  }
  if (!Array.isArray(parsed)) {
    throw new PromotionSlideSaveError("promotion_slide_payload_invalid");
  }
  if (parsed.length === 0) {
    throw new PromotionSlideSaveError("promotion_slide_empty");
  }

  const slides = parsed.map((item, index): PromotionSlideDraftPayload => {
    const slideNumber = index + 1;
    if (!item || typeof item !== "object") {
      throw new PromotionSlideSaveError("promotion_slide_payload_invalid", slideNumber);
    }
    const record = item as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id.trim() : "";
    if (!id) {
      throw new PromotionSlideSaveError("promotion_slide_id_required", slideNumber);
    }
    const href = typeof record.href === "string" ? record.href.trim() : "";
    const derivedEventSlug = extractEventSlugFromHref(href);
    const rawEventSlug =
      typeof record.eventSlug === "string" && record.eventSlug.trim()
        ? normalizeSlug(record.eventSlug)
        : null;
    const eventSlug =
      derivedEventSlug && (!rawEventSlug || rawEventSlug === derivedEventSlug)
        ? derivedEventSlug
        : null;
    const sponsorLabel =
      typeof record.sponsorLabel === "string" ? record.sponsorLabel.trim() : "";
    if (sponsorLabel.length > AD_PACKAGE_FORM_LIMITS.sponsorLabelMax) {
      throw new PromotionSlideSaveError("promotion_slide_sponsor_label_too_long", slideNumber);
    }
    const uploadId = typeof record.uploadId === "string" ? record.uploadId.trim() : "";
    if (
      uploadId
      && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uploadId)
    ) {
      throw new PromotionSlideSaveError("promotion_slide_upload_invalid", slideNumber);
    }
    return {
      id,
      title: typeof record.title === "string" ? record.title.trim() : "",
      subtitle: typeof record.subtitle === "string" ? record.subtitle.trim() : "",
      imageSrc: typeof record.imageSrc === "string" ? record.imageSrc.trim() : "",
      imageAlt: typeof record.imageAlt === "string" ? record.imageAlt.trim() : "",
      href,
      isActive: record.isActive === true,
      audiences: normalizePromotionAudiences(record.audiences),
      allowedCampuses: normalizeStringArray(record.allowedCampuses),
      eventSlug,
      adCampaignId:
        typeof record.adCampaignId === "string" && record.adCampaignId.trim()
          ? record.adCampaignId.trim()
          : null,
      sponsorLabel,
      uploadId: uploadId || null,
    };
  });
  const ids = new Set(slides.map((slide) => slide.id));
  if (ids.size !== slides.length) {
    throw new PromotionSlideSaveError("promotion_slide_id_duplicated");
  }
  return slides;
}

async function listRegisteredPromotionEventSlugs(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  slugs: string[],
) {
  const unique = [...new Set(slugs)];
  if (unique.length === 0) {
    return new Set<string>();
  }
  const { data, error } = await supabase
    .from("promotion_events")
    .select("slug")
    .in("slug", unique);
  if (error) {
    throw new Error(error.message);
  }
  return new Set(((data ?? []) as Array<{ slug: string }>).map((row) => row.slug));
}

function revalidateAdvertisementPaths() {
  revalidateTag(PROMOTION_EVENTS_CACHE_TAG, "max");
  revalidateTag(PROMOTION_SLIDES_CACHE_TAG, "max");
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/advertisement");
  revalidatePath("/admin/promotions");
}

export async function createPromotionEventAction(formData: FormData) {
  await requireAdminPermission("events", "create", { path: "/admin/event" });
  const slug = normalizeSlug(getString(formData, "slug"));
  let payload: ReturnType<typeof parsePromotionEventRegistration>;
  try {
    payload = parsePromotionEventRegistration(formData, slug);
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
  } catch (error) {
    redirectEventRegistrationError(slug, "admin_event_create_failed", error);
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
  await requireAdminPermission("events", "update", { path: "/admin/event" });
  const id = getString(formData, "id");
  const slug = normalizeSlug(getString(formData, "slug"));
  let payload: ReturnType<typeof parsePromotionEventRegistration>;
  let target: { id?: string | null; slug?: string | null } | null;
  try {
    const supabase = getSupabaseAdminClient();
    const { data: existing, error: existingError } = await supabase
      .from("promotion_events")
      .select("id,slug")
      .eq("id", id)
      .maybeSingle();
    if (existingError) {
      throw new Error(existingError.message);
    }

    const { data: existingBySlug, error: existingBySlugError } = existing?.slug
      ? { data: null, error: null }
      : await supabase
          .from("promotion_events")
          .select("id,slug")
          .eq("slug", slug)
          .maybeSingle();
    if (existingBySlugError) {
      throw new Error(existingBySlugError.message);
    }

    target = existing ?? existingBySlug;
    payload = parsePromotionEventRegistration(formData, target?.slug ?? slug);
    const { error } = target?.id
      ? await supabase.from("promotion_events").update(payload).eq("id", target.id)
      : await supabase.from("promotion_events").insert(payload);
    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    redirectEventRegistrationError(slug, "admin_event_update_failed", error);
  }
  await logAdminAction("promotion_event_update", {
    targetType: "promotion_event",
    targetId: target?.id ?? payload.slug,
    properties: {
      slug: payload.slug,
      pagePath: payload.page_path,
      targetAudiences: payload.target_audiences,
      recoveredFromMissingId: !id,
    },
  });
  revalidatePromotionPaths(payload.slug);
  redirect(`/admin/event/${payload.slug}?status=updated`);
}

export async function deletePromotionEventAction(formData: FormData) {
  await requireAdminPermission("events", "delete", { path: "/admin/event" });
  const id = getString(formData, "id");
  const slug = getString(formData, "slug") || id;
  try {
    if (!id) {
      throw new Error("이벤트 식별자를 확인해 주세요.");
    }
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from("promotion_events").delete().eq("id", id);
    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    redirectEventRegistrationError(slug, "admin_event_delete_failed", error);
  }
  await logAdminAction("promotion_event_delete", {
    targetType: "promotion_event",
    targetId: id,
    properties: { slug },
  });
  revalidatePromotionPaths(slug);
  redirect("/admin/event?status=deleted");
}

export async function savePromotionSlidesAction(formData: FormData) {
  await requireAdminPermission("home_ads", "update", { path: "/admin/advertisement" });
  try {
    await savePromotionSlidesMutation(formData);
  } catch (error) {
    console.error("[admin-advertisement] promotion slide save failed", error);
    redirectAdvertisementError("promotion_slide_save_failed", error);
  }
  redirect("/admin/advertisement?status=updated");
}

async function savePromotionSlidesMutation(formData: FormData) {
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
    event_slug: string | null;
    ad_campaign_id: string | null;
    sponsor_label: string;
  }> = [];
  const removedImageUrls = new Set<string>();
  const nextImageUrls = new Set<string>();
  // promotion_slides.event_slug references promotion_events(slug). Event pages that
  // are not promotion campaigns (the project showcase) keep a null link; the read
  // model derives their slug from href for visibility.
  const registeredEventSlugs = await listRegisteredPromotionEventSlugs(
    supabase,
    slides.flatMap((slide) => (slide.eventSlug ? [slide.eventSlug] : [])),
  );
  const uploadActor = await resolveImageUploadActorForServerAction("promotion", "admin");
  const uploadRepository = getImageUploadRepository();

  for (const [index, slide] of slides.entries()) {
    const slideNumber = index + 1;
    const existing = existingMap.get(slide.id);
    const [issue] = validatePromotionSlide({
      ...slide,
      hasImage: Boolean(slide.uploadId || existing?.image_src),
    });
    if (issue) {
      throw new PromotionSlideSaveError(issue.code, slideNumber);
    }

    try {
      assertPromotionSlideImageSource({
        imageSrc: slide.imageSrc,
        existingImageSrc: existing?.image_src,
        uploadId: slide.uploadId,
      });
    } catch {
      throw new PromotionSlideSaveError("promotion_slide_image_source_invalid", slideNumber);
    }
    let imageSrc = slide.imageSrc;
    if (slide.uploadId) {
      const attached = await uploadRepository.attach({
        actor: uploadActor,
        purpose: "promotion",
        uploadId: slide.uploadId,
        role: "slide",
        policy: resolveImageTransformPolicy("promotion", "slide"),
        destination: {
          bucket: PROMOTION_SLIDES_BUCKET,
          path: `promotions/${slide.id}-${slide.uploadId}.webp`,
          isPublic: true,
        },
        resource: { type: "promotion_slide", id: slide.id },
      }).catch((error: unknown) => {
        console.error("[admin-advertisement] promotion slide image attach failed", {
          slideNumber,
          error: error instanceof Error ? error.message : "unknown",
        });
        throw new PromotionSlideSaveError("promotion_slide_image_attach_failed", slideNumber);
      });
      imageSrc = attached.url ?? "";
    }
    if (!imageSrc) {
      throw new PromotionSlideSaveError("promotion_slide_image_required", slideNumber);
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
      event_slug:
        slide.eventSlug && registeredEventSlugs.has(slide.eventSlug)
          ? slide.eventSlug
          : null,
      ad_campaign_id: slide.adCampaignId,
      sponsor_label: slide.sponsorLabel,
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
}

export async function createEventRewardDrawAction(formData: FormData) {
  await requireAdminPermission("events", "create", { path: "/admin/event" });
  const slug = eventRewardActionSlug(formData);
  const winnerCount = getString(formData, "winnerCount");
  const seed = getString(formData, "seed");
  const googleFormUrl = getString(formData, "googleFormUrl");
  const definition = getEventPageDefinition(slug);
  if (!definition) {
    redirectEventRewardDrawError({
      slug,
      message: "이벤트 정의를 찾을 수 없습니다.",
      winnerCount,
      seed,
    });
  }
  const campaign = (await getManagedEventCampaign(slug)) ?? definition;
  const request = parseEventRewardDrawRequest({
    winnerCount,
    seed,
    googleFormUrl,
  });
  if (!request.ok) {
    redirectEventRewardDrawError({
      slug,
      message: request.message,
      winnerCount,
      seed,
    });
  }
  const adminSession = await getAdminSession();
  let draw: Awaited<ReturnType<typeof createStoredEventRewardDraw>>;
  try {
    draw = await createStoredEventRewardDraw({
      campaign,
      request: request.value,
      createdByAdminId: adminSession?.adminId ?? null,
    });
  } catch (error) {
    console.error("[admin-event] reward draw create failed", error);
    redirectEventRewardDrawError({
      slug,
      message: eventRewardActionErrorMessage(
        error,
        "추첨 결과를 확정하지 못했습니다.",
      ),
      winnerCount,
      seed,
    });
  }

  await logAdminAction("event_reward_draw_create", {
    targetType: "event_reward_draw",
    targetId: draw.id,
    properties: {
      eventSlug: slug,
      winnerCount: draw.winnerCount,
      candidateCount: draw.candidateCount,
      totalTickets: draw.totalTickets,
    },
  });
  revalidatePromotionPaths(slug);
  redirect(`/admin/event/${slug}?status=draw-created`);
}

export async function previewEventRewardDrawAction(formData: FormData) {
  await requireAdminPermission("events", "read", { path: "/admin/event" });
  const slug = eventRewardActionSlug(formData);
  const winnerCount = getString(formData, "winnerCount");
  const seed = getString(formData, "seed");
  const request = parseEventRewardDrawPreviewRequest({
    winnerCount,
    seed,
  });
  if (!request.ok) {
    redirectEventRewardDrawPreviewError({
      slug,
      message: request.message,
      winnerCount,
      seed,
    });
  }
  const params = new URLSearchParams({
    status: "draw-preview",
    previewWinnerCount: String(request.value.winnerCount),
    previewSeed: request.value.seed,
  });

  await logAdminAction("event_reward_draw_preview", {
    targetType: "promotion_event",
    targetId: slug,
    properties: {
      eventSlug: slug,
      winnerCount: request.value.winnerCount,
      seed: request.value.seed,
    },
  });
  redirect(`/admin/event/${slug}?${params.toString()}`);
}

export async function sendEventRewardWinnerNotificationsAction(formData: FormData) {
  await requireAdminPermission("events", "update", { path: "/admin/event" });
  const slug = normalizeSlug(getString(formData, "slug"));
  const drawId = getString(formData, "drawId");
  let result: Awaited<ReturnType<typeof sendEventRewardWinnerNotifications>>;
  try {
    if (!slug || !drawId) {
      throw new Error("당첨 안내 대상 정보를 확인해 주세요.");
    }
    result = await sendEventRewardWinnerNotifications(drawId, {
      eventSlug: slug,
      confirmationText: getString(formData, "confirmationText"),
    });
  } catch (error) {
    redirectEventRewardDrawError({
      slug: slug || "signup-reward",
      message: eventRewardActionErrorMessage(
        error,
        "당첨 안내를 발송하지 못했습니다. 발송 조건과 설정을 확인해 주세요.",
      ),
    });
  }

  await logAdminAction("event_reward_winner_notification_send", {
    targetType: "event_reward_draw",
    targetId: drawId,
    properties: {
      eventSlug: slug,
      status: result.status,
      notificationId: result.notificationId,
      warnings: result.warnings.length,
    },
  });
  revalidatePromotionPaths(slug);
  redirect(`/admin/event/${slug}?status=winner-sent`);
}

export async function sendEventRewardWinnerTestNotificationAction(formData: FormData) {
  await requireAdminPermission("events", "update", { path: "/admin/event" });
  const slug = normalizeSlug(getString(formData, "slug"));
  const drawId = getString(formData, "drawId") || null;
  const memberId = getString(formData, "memberId");
  let result: Awaited<ReturnType<typeof sendEventRewardWinnerTestNotification>>;
  try {
    if (!slug || !memberId) {
      throw new Error("테스트 안내 대상 정보를 확인해 주세요.");
    }
    result = await sendEventRewardWinnerTestNotification(drawId, {
      eventSlug: slug,
      memberId,
    });
  } catch (error) {
    redirectEventRewardDrawError({
      slug: slug || "signup-reward",
      message: eventRewardActionErrorMessage(
        error,
        "당첨 안내 테스트를 발송하지 못했습니다. 대상 회원과 설정을 확인해 주세요.",
      ),
    });
  }

  await logAdminAction("event_reward_winner_notification_test_send", {
    targetType: "event_reward_draw",
    targetId: drawId ?? slug,
    properties: {
      eventSlug: slug,
      drawId,
      memberId,
      status: result.status,
      notificationId: result.notificationId,
      warnings: result.warnings.length,
    },
  });
  revalidatePromotionPaths(slug);
  redirect(`/admin/event/${slug}?status=winner-test-sent`);
}
