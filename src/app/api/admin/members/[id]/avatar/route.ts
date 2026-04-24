import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ensureAdminApiAccess } from "@/lib/admin-access";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const runtime = "nodejs";

function isUuid(value: string) {
  return UUID_PATTERN.test(value.trim());
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const accessDenied = await ensureAdminApiAccess(request);
  if (accessDenied) {
    return accessDenied;
  }

  const { id } = await context.params;
  if (!isUuid(id)) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("members")
    .select("avatar_content_type,avatar_base64,updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { message: "아바타를 불러오지 못했습니다." },
      { status: 500 },
    );
  }

  if (!data?.avatar_base64 || !data.avatar_content_type) {
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
      "cache-control": "private, max-age=31536000, immutable",
      ...(data.updated_at
        ? { "last-modified": new Date(data.updated_at).toUTCString() }
        : {}),
    },
  });
}
