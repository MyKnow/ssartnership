"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { EventCondition, EventConditionKey } from "@/lib/promotions/catalog";
import { logAdminAction } from "./shared-helpers";
import { revalidatePath } from "next/cache";

const conditionKeys: EventConditionKey[] = [
  "signup",
  "mm",
  "push",
  "marketing",
  "review",
];

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

function parseRules(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseCondition(formData: FormData, key: EventConditionKey): EventCondition {
  const tickets = Number.parseInt(getString(formData, `condition_${key}_tickets`) || "0", 10);
  return {
    key,
    title: getRequiredString(formData, `condition_${key}_title`),
    description: getRequiredString(formData, `condition_${key}_description`),
    tickets: Number.isFinite(tickets) ? Math.max(0, tickets) : 0,
    ctaHref: getRequiredString(formData, `condition_${key}_ctaHref`),
    ctaLabel: getRequiredString(formData, `condition_${key}_ctaLabel`),
    repeatable: formData.get(`condition_${key}_repeatable`) === "on",
  };
}

function parsePromotionEventPayload(formData: FormData) {
  const slug = normalizeSlug(getRequiredString(formData, "slug"));
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("slug는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.");
  }

  const startsAt = parseDateTimeLocal(getRequiredString(formData, "startsAt"));
  const endsAt = parseDateTimeLocal(getRequiredString(formData, "endsAt"));
  if (new Date(startsAt).getTime() > new Date(endsAt).getTime()) {
    throw new Error("이벤트 시작 시각은 종료 시각보다 늦을 수 없습니다.");
  }

  return {
    slug,
    title: getRequiredString(formData, "title"),
    short_title: getRequiredString(formData, "shortTitle"),
    description: getRequiredString(formData, "description"),
    period_label: getRequiredString(formData, "periodLabel"),
    starts_at: startsAt,
    ends_at: endsAt,
    hero_image_src: getRequiredString(formData, "heroImageSrc"),
    hero_image_alt: getRequiredString(formData, "heroImageAlt"),
    conditions: conditionKeys.map((key) => parseCondition(formData, key)),
    rules: parseRules(getRequiredString(formData, "rules")),
    is_active: formData.get("isActive") === "on",
  };
}

function revalidatePromotionPaths(slug: string) {
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/promotions");
  revalidatePath("/events/[slug]", "page");
  revalidatePath(`/events/${slug}`);
}

export async function createPromotionEventAction(formData: FormData) {
  await requireAdmin();
  const payload = parsePromotionEventPayload(formData);
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("promotion_events").insert(payload);
  if (error) {
    throw new Error(error.message);
  }
  await logAdminAction("promotion_event_create", {
    targetType: "promotion_event",
    targetId: payload.slug,
    properties: { slug: payload.slug, title: payload.title },
  });
  revalidatePromotionPaths(payload.slug);
  redirect("/admin/promotions?status=created");
}

export async function updatePromotionEventAction(formData: FormData) {
  await requireAdmin();
  const id = getRequiredString(formData, "id");
  const payload = parsePromotionEventPayload(formData);
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("promotion_events").update(payload).eq("id", id);
  if (error) {
    throw new Error(error.message);
  }
  await logAdminAction("promotion_event_update", {
    targetType: "promotion_event",
    targetId: id,
    properties: { slug: payload.slug, title: payload.title },
  });
  revalidatePromotionPaths(payload.slug);
  redirect("/admin/promotions?status=updated");
}
