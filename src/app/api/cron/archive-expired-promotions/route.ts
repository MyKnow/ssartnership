import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function isAuthorizedByCronSecret(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  const adminAuthorized = await isAdminSession();
  if (!adminAuthorized && !isAuthorizedByCronSecret(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();
  const nowIso = new Date().toISOString();
  const { data: expiredEvents, error: eventQueryError } = await supabase
    .from("promotion_events")
    .select("slug")
    .eq("is_active", true)
    .lt("ends_at", nowIso);

  if (eventQueryError) {
    return NextResponse.json(
      { ok: false, message: eventQueryError.message },
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
    return NextResponse.json(
      { ok: false, message: eventUpdateError.message },
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
    return NextResponse.json(
      { ok: false, message: slideUpdateError.message },
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
