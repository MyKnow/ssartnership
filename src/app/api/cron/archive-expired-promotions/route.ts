import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ARCHIVE_EVENT_BATCH_SIZE = 100;
const ARCHIVE_ERROR_MESSAGE = "만료된 프로모션을 정리하지 못했습니다.";

function isAuthorizedByCronSecret(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedByCronSecret(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

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
    return NextResponse.json(
      { ok: false, message: ARCHIVE_ERROR_MESSAGE },
      { status: 500 },
    );
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
    return NextResponse.json(
      { ok: false, message: ARCHIVE_ERROR_MESSAGE },
      { status: 500 },
    );
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
    return NextResponse.json(
      { ok: false, message: ARCHIVE_ERROR_MESSAGE },
      { status: 500 },
    );
  }

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
