import { NextResponse } from "next/server";
import { getSignedUserSession } from "@/lib/user-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function normalizeAvatarUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export async function GET() {
  const session = await getSignedUserSession();
  if (!session?.userId) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const { data, error } = await getSupabaseAdminClient()
    .from("members")
    .select("id,avatar_content_type,avatar_base64,avatar_url,updated_at")
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

  const avatarUrl = normalizeAvatarUrl(data.avatar_url);
  if (avatarUrl) {
    const response = NextResponse.redirect(avatarUrl, 302);
    response.headers.set("cache-control", "private, max-age=300");
    return response;
  }

  if (!data.avatar_base64 || !data.avatar_content_type) {
    return NextResponse.json(
      { message: "아바타를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  if (!data.avatar_content_type.startsWith("image/")) {
    return NextResponse.json(
      { message: "지원하지 않는 아바타 형식입니다." },
      { status: 415 },
    );
  }

  let body: ArrayBuffer;
  try {
    const binary = Buffer.from(data.avatar_base64, "base64");
    body = binary.buffer.slice(
      binary.byteOffset,
      binary.byteOffset + binary.byteLength,
    );
  } catch {
    return NextResponse.json(
      { message: "아바타 데이터 형식이 올바르지 않습니다." },
      { status: 500 },
    );
  }

  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": data.avatar_content_type,
      "content-length": String(body.byteLength),
      "cache-control": "private, max-age=300",
      ...(data.updated_at
        ? { "last-modified": new Date(data.updated_at).toUTCString() }
        : {}),
    },
  });
}
