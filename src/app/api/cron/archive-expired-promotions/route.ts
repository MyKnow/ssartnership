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
  const { data: expiredEvents, error: eventQueryError } = await supabase
    .from("promotion_events")
    .select("slug")
    .eq("is_active", true)
    .lt("ends_at", nowIso)
    .limit(ARCHIVE_EVENT_BATCH_SIZE);

  if (eventQueryError) {
    console.error("[archive-expired-promotions] event query failed", {
      code: eventQueryError.code,
    });
    return getCronErrorResponse("archive-expired-promotions");
  }

  const slugs = (expiredEvents ?? [])
    .map((event) => String(event.slug ?? "").trim())
    .filter(Boolean);

  if (slugs.length === 0) {
    return NextResponse.json({
      ok: true,
      archivedEvents: 0,
      archivedSlides: 0,
      archivedAt: nowIso,
    });
  }

  const { error: eventUpdateError } = await supabase
    .from("promotion_events")
    .update({ is_active: false })
    .in("slug", slugs);
  if (eventUpdateError) {
    console.error("[archive-expired-promotions] event update failed", {
      code: eventUpdateError.code,
    });
    return getCronErrorResponse("archive-expired-promotions");
  }

  const { data: updatedSlides, error: slideUpdateError } = await supabase
    .from("promotion_slides")
    .update({ is_active: false })
    .in("event_slug", slugs)
    .eq("is_active", true)
    .select("id");
  if (slideUpdateError) {
    console.error("[archive-expired-promotions] slide update failed", {
      code: slideUpdateError.code,
    });
    return getCronErrorResponse("archive-expired-promotions");
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
    archivedSlides: updatedSlides?.length ?? 0,
    slugs,
    archivedAt: nowIso,
  });
}
