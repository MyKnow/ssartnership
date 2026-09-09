import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { ensureCronApiAccess, getCronErrorResponse } from "@/lib/cron-route";
import {
  PROMOTION_EVENTS_CACHE_TAG,
  PROMOTION_SLIDES_CACHE_TAG,
} from "@/lib/promotions/events";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ARCHIVE_EVENT_BATCH_SIZE = 100;

export async function GET(request: NextRequest) {
  const denied = ensureCronApiAccess(request);
  if (denied) return denied;

  const supabase = getSupabaseAdminClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase.rpc("archive_expired_promotions_batch", {
    input_now: nowIso,
    input_limit: ARCHIVE_EVENT_BATCH_SIZE,
  });

  if (error) {
    console.error("[archive-expired-promotions] archive rpc failed", {
      code: error.code,
    });
    return getCronErrorResponse("archive-expired-promotions");
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    console.error("[archive-expired-promotions] archive rpc returned no row");
    return getCronErrorResponse("archive-expired-promotions");
  }

  const slugs = Array.isArray(row.archived_event_slugs)
    ? row.archived_event_slugs
        .map((slug: unknown) => (typeof slug === "string" ? slug.trim() : ""))
        .filter(Boolean)
    : [];
  const archivedSlides = Number(row.archived_slide_count ?? 0);
  if (!Number.isFinite(archivedSlides) || archivedSlides < 0) {
    console.error("[archive-expired-promotions] archive rpc returned invalid slide count");
    return getCronErrorResponse("archive-expired-promotions");
  }

  if (slugs.length === 0) {
    return NextResponse.json({
      ok: true,
      archivedEvents: 0,
      archivedSlides: 0,
      archivedAt: nowIso,
    });
  }

  revalidateTag(PROMOTION_EVENTS_CACHE_TAG, "max");
  revalidateTag(PROMOTION_SLIDES_CACHE_TAG, "max");
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/advertisement");
  revalidatePath("/admin/event");
  for (const slug of slugs) {
    revalidatePath(`/events/${slug}`);
    revalidatePath(`/admin/event/${slug}`);
  }

  return NextResponse.json({
    ok: true,
    archivedEvents: slugs.length,
    archivedSlides,
    slugs,
    archivedAt: nowIso,
  });
}
