import { NextResponse } from "next/server";
import { createMemberAvatarResponse } from "@/lib/member-avatar-response";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getSignedUserSession } from "@/lib/user-auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSignedUserSession();
  if (!session?.userId) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("members")
    .select("avatar_content_type,avatar_base64,avatar_url,updated_at")
    .eq("id", session.userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { message: "아바타를 불러오지 못했습니다." },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json(
      { message: "아바타를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  return createMemberAvatarResponse(
    {
      avatarUrl: data.avatar_url,
      avatarBase64: data.avatar_base64,
      avatarContentType: data.avatar_content_type,
    },
    {
      cacheControl: "private, max-age=300",
      lastModified: data.updated_at,
    },
  );
}
