import { NextResponse } from "next/server";
import { verifyCertificationQrToken } from "@/lib/certification-qr";
import { createMemberAvatarResponse } from "@/lib/member-avatar-response";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const rawToken = token ? decodeURIComponent(token).trim() : "";
  const verification = verifyCertificationQrToken(rawToken);
  if (!verification.ok) {
    return NextResponse.json(
      { message: "유효하지 않은 QR입니다." },
      { status: verification.reason === "expired" ? 410 : 404 },
    );
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("members")
    .select("avatar_content_type,avatar_base64,avatar_url,updated_at,must_change_password")
    .eq("id", verification.payload.userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { message: "아바타를 불러오지 못했습니다." },
      { status: 500 },
    );
  }

  if (!data || data.must_change_password) {
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
      cacheControl: "private, no-store",
      lastModified: data.updated_at,
    },
  );
}
