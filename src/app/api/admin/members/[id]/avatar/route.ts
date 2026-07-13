import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ensureAdminApiPermission } from "@/lib/admin-access";
import { downloadPrivateMemberProfileImage } from "@/lib/graduate-verification-storage";
import { syncMemberMattermostProfile } from "@/lib/member-mattermost-profile-sync";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const runtime = "nodejs";

function isUuid(value: string) {
  return UUID_PATTERN.test(value.trim());
}

async function getActiveProfileImage(memberId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("members")
    .select("active_profile_image_id,profile_photo_review_status")
    .eq("id", memberId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !data?.active_profile_image_id) {
    return null;
  }
  if (data.profile_photo_review_status !== "approved") {
    return null;
  }

  const { data: image, error: imageError } = await supabase
    .from("member_profile_images")
    .select("storage_path")
    .eq("id", data.active_profile_image_id)
    .eq("status", "approved")
    .is("deleted_at", null)
    .maybeSingle();
  if (imageError || !image?.storage_path) {
    return null;
  }
  return image.storage_path as string;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const accessDenied = await ensureAdminApiPermission(request, "members", "read");
  if (accessDenied) {
    return accessDenied;
  }

  const { id } = await context.params;
  if (!isUuid(id)) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }

  let storagePath = await getActiveProfileImage(id);
  if (!storagePath) {
    try {
      await syncMemberMattermostProfile(id);
      storagePath = await getActiveProfileImage(id);
    } catch (error) {
      console.error("[admin-member-avatar] profile sync failed", error);
    }
  }
  if (!storagePath) {
    return NextResponse.json(
      { message: "아바타를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const body = await downloadPrivateMemberProfileImage(storagePath);
  if (!body) {
    return NextResponse.json(
      { message: "아바타를 불러오지 못했습니다." },
      { status: 404 },
    );
  }

  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": "image/webp",
      "content-length": String(body.byteLength),
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
