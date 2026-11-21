// Server-only write paths for promotion_events.
// Admin actions keep validation, error-code mapping, audit logging, and cache
// revalidation; this module only owns the database statements so routes and
// actions stop issuing raw promotion_events queries.
import type {
  EventCondition,
  PromotionAudience,
} from "@/lib/promotions/catalog";
import {
  PromotionSlideSaveError,
  promotionSlideDatabaseErrorCode,
} from "@/lib/promotions/slide-validation";
import { logServerError } from "@/lib/server-log";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdminClient>;

export type PromotionEventRegistrationRow = {
  slug: string;
  page_path: string;
  target_audiences: PromotionAudience[];
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  title: string;
  short_title: string;
  description: string;
  period_label: string;
  hero_image_src: string;
  hero_image_alt: string;
  conditions: EventCondition[];
  rules: string[];
};

export type PromotionEventRegistrationTarget = {
  id?: string | null;
  slug?: string | null;
};

export async function listRegisteredPromotionEventSlugs(
  supabase: SupabaseAdminClient,
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
    logServerError("[admin-advertisement] event lookup failed", error);
    throw new PromotionSlideSaveError(promotionSlideDatabaseErrorCode(error.code, "promotion_slide_event_lookup_failed"));
  }
  return new Set(((data ?? []) as Array<{ slug: string }>).map((row) => row.slug));
}

export async function insertPromotionEventRegistration(
  payload: PromotionEventRegistrationRow,
) {
  const supabase = getSupabaseAdminClient();
  const { data: existing, error: existingError } = await supabase
    .from("promotion_events")
    .select("id")
    .eq("slug", payload.slug)
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
}

/**
 * Resolves the registration row an update should target. A form that lost its
 * id (stale page) recovers by slug so the update does not create a duplicate.
 */
export async function findPromotionEventRegistrationTarget(input: {
  id: string;
  slug: string;
}): Promise<PromotionEventRegistrationTarget | null> {
  const supabase = getSupabaseAdminClient();
  const { data: existing, error: existingError } = await supabase
    .from("promotion_events")
    .select("id,slug")
    .eq("id", input.id)
    .maybeSingle();
  if (existingError) {
    throw new Error(existingError.message);
  }

  const { data: existingBySlug, error: existingBySlugError } = existing?.slug
    ? { data: null, error: null }
    : await supabase
        .from("promotion_events")
        .select("id,slug")
        .eq("slug", input.slug)
        .maybeSingle();
  if (existingBySlugError) {
    throw new Error(existingBySlugError.message);
  }

  return existing ?? existingBySlug;
}

export async function savePromotionEventRegistration(
  target: PromotionEventRegistrationTarget | null,
  payload: PromotionEventRegistrationRow,
) {
  const supabase = getSupabaseAdminClient();
  const { error } = target?.id
    ? await supabase.from("promotion_events").update(payload).eq("id", target.id)
    : await supabase.from("promotion_events").insert(payload);
  if (error) {
    throw new Error(error.message);
  }
}

export async function deletePromotionEventRegistration(id: string) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("promotion_events").delete().eq("id", id);
  if (error) {
    throw new Error(error.message);
  }
}

export type PromotionArchiveFailureReason =
  | "rpc_failed"
  | "missing_row"
  | "invalid_slide_count";

export class PromotionArchiveError extends Error {
  readonly reason: PromotionArchiveFailureReason;

  constructor(reason: PromotionArchiveFailureReason) {
    super(`promotion archive failed: ${reason}`);
    this.name = "PromotionArchiveError";
    this.reason = reason;
  }
}

export type ArchiveExpiredPromotionsResult = {
  slugs: string[];
  archivedSlides: number;
};

/**
 * Archives expired promotion events and their linked slides atomically through
 * the service-role-only RPC. Throws PromotionArchiveError without leaking the
 * database message so the cron route can answer with a generic failure.
 */
export async function archiveExpiredPromotionsBatch(input: {
  nowIso: string;
  limit: number;
}): Promise<ArchiveExpiredPromotionsResult> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc("archive_expired_promotions_batch", {
    input_now: input.nowIso,
    input_limit: input.limit,
  });

  if (error) {
    console.error("[archive-expired-promotions] archive rpc failed", {
      code: error.code,
    });
    throw new PromotionArchiveError("rpc_failed");
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    console.error("[archive-expired-promotions] archive rpc returned no row");
    throw new PromotionArchiveError("missing_row");
  }

  const slugs: string[] = Array.isArray(row.archived_event_slugs)
    ? row.archived_event_slugs
        .map((slug: unknown) => (typeof slug === "string" ? slug.trim() : ""))
        .filter(Boolean)
    : [];
  const archivedSlides = Number(row.archived_slide_count ?? 0);
  if (!Number.isFinite(archivedSlides) || archivedSlides < 0) {
    console.error("[archive-expired-promotions] archive rpc returned invalid slide count");
    throw new PromotionArchiveError("invalid_slide_count");
  }

  return { slugs, archivedSlides };
}
