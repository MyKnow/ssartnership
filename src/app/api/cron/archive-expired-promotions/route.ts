import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { ensureCronApiAccess, getCronErrorResponse } from "@/lib/cron-route";
import {
  PROMOTION_EVENTS_CACHE_TAG,
  PROMOTION_SLIDES_CACHE_TAG,
} from "@/lib/promotions/events";
import {
  archiveExpiredPromotionsBatch,
  PromotionArchiveError,
  type ArchiveExpiredPromotionsResult,
} from "@/lib/promotions/events-store.server";

export const runtime = "nodejs";

const ARCHIVE_EVENT_BATCH_SIZE = 100;

export async function GET(request: NextRequest) {
  const denied = ensureCronApiAccess(request);
  if (denied) return denied;

  const nowIso = new Date().toISOString();
  let result: ArchiveExpiredPromotionsResult;
  try {
    result = await archiveExpiredPromotionsBatch({
      nowIso,
      limit: ARCHIVE_EVENT_BATCH_SIZE,
    });
  } catch (error) {
    if (!(error instanceof PromotionArchiveError)) {
      console.error("[archive-expired-promotions] archive failed", {
        name: error instanceof Error ? error.name : "unknown",
      });
    }
    return getCronErrorResponse("archive-expired-promotions");
  }

  const { slugs, archivedSlides } = result;
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
