import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ensureAdminApiAccess } from "@/lib/admin-access";
import {
  getMemberSyncCandidateYears,
  resolveMemberSnapshotForYears,
} from "@/lib/mm-member-sync";
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
    .select("id,mm_user_id,mm_username,display_name,year,staff_source_year,campus,avatar_content_type,avatar_base64,updated_at")
    .eq("id", id)
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

  let avatarContentType = data.avatar_content_type;
  let avatarBase64 = data.avatar_base64;

  if (!avatarBase64 && data.mm_user_id && typeof data.year === "number") {
    try {
      const resolved = await resolveMemberSnapshotForYears(
        {
          id: data.id,
          mm_user_id: data.mm_user_id,
          mm_username: data.mm_username,
          display_name: data.display_name,
          year: data.year,
          staff_source_year: data.staff_source_year,
          campus: data.campus,
          avatar_content_type: data.avatar_content_type,
          avatar_base64: data.avatar_base64,
          updated_at: data.updated_at,
        },
        getMemberSyncCandidateYears(data.staff_source_year ?? data.year),
        new Map(),
      );

      if (resolved?.snapshot.avatarBase64 && resolved.snapshot.avatarContentType) {
        avatarContentType = resolved.snapshot.avatarContentType;
        avatarBase64 = resolved.snapshot.avatarBase64;
        await supabase
          .from("members")
          .update({
            avatar_content_type: avatarContentType,
            avatar_base64: avatarBase64,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id);
      }
    } catch (error) {
      console.error("[admin-member-avatar] Mattermost avatar fallback failed", error);
    }
  }

  if (!avatarBase64 || !avatarContentType) {
    return NextResponse.json(
      { message: "아바타를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  if (!avatarContentType.startsWith("image/")) {
    return NextResponse.json(
      { message: "지원하지 않는 아바타 형식입니다." },
      { status: 415 },
    );
  }

  let body: ArrayBuffer;
  try {
    const binary = Buffer.from(avatarBase64, "base64");
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
      "content-type": avatarContentType,
      "content-length": String(body.byteLength),
      "cache-control": "private, max-age=31536000, immutable",
      ...(data.updated_at
        ? { "last-modified": new Date(data.updated_at).toUTCString() }
        : {}),
    },
  });
}
