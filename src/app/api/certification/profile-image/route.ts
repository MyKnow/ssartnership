import { NextResponse } from "next/server";
import { downloadPrivateMemberProfileImage } from "@/lib/graduate-verification-storage";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getSignedUserSession } from "@/lib/user-auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSignedUserSession();
  if (!session?.userId) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  const supabase = getSupabaseAdminClient();
  const { data: member } = await supabase
    .from("members")
    .select("active_profile_image_id,must_change_password")
    .eq("id", session.userId)
    .maybeSingle();
  const imageId = (member as { active_profile_image_id?: string | null; must_change_password?: boolean | null } | null)?.active_profile_image_id;
  if (!imageId || member?.must_change_password) {
    return NextResponse.json({ message: "본인 사진을 찾을 수 없습니다." }, { status: 404 });
  }
  const { data: image } = await supabase
    .from("member_profile_images")
    .select("storage_path,status")
    .eq("id", imageId)
    .eq("status", "approved")
    .maybeSingle();
  const path = (image as { storage_path?: string | null } | null)?.storage_path;
  if (!path) return NextResponse.json({ message: "본인 사진을 찾을 수 없습니다." }, { status: 404 });
  const body = await downloadPrivateMemberProfileImage(path);
  if (!body) return NextResponse.json({ message: "본인 사진을 불러오지 못했습니다." }, { status: 404 });
  return new NextResponse(body, {
    headers: {
      "content-type": "image/webp",
      "content-length": String(body.byteLength),
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
