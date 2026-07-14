import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ensureAdminApiPermission } from "@/lib/admin-access";
import { createGraduateVerificationSignedUpload } from "@/lib/graduate-verification-storage";
import { isTrustedSameOriginRequest } from "@/lib/request-guards";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isProfileImageContentType(value: unknown): value is "image/jpeg" | "image/png" | "image/webp" {
  return value === "image/jpeg" || value === "image/png" || value === "image/webp";
}

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!isTrustedSameOriginRequest(request, {
    expectedOrigin: request.nextUrl.origin,
    allowedContentTypes: ["application/json"],
  })) {
    return NextResponse.json({ ok: false, message: "요청을 확인해 주세요." }, { status: 403 });
  }
  const denied = await ensureAdminApiPermission(request, "profile_images", "update");
  if (denied) return denied;

  const { id: memberId } = await context.params;
  const body = await request.json().catch(() => null) as {
    contentType?: unknown;
    size?: unknown;
  } | null;
  if (!UUID_PATTERN.test(memberId) || !isProfileImageContentType(body?.contentType) || typeof body?.size !== "number") {
    return NextResponse.json({ ok: false, message: "사진 업로드 요청을 확인해 주세요." }, { status: 400 });
  }

  const { data: member, error } = await getSupabaseAdminClient()
    .from("members")
    .select("id")
    .eq("id", memberId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !member?.id) {
    return NextResponse.json({ ok: false, message: "회원을 찾을 수 없습니다." }, { status: 404 });
  }

  try {
    const upload = await createGraduateVerificationSignedUpload({
      memberId,
      kind: "profile_image",
      contentType: body.contentType,
      size: body.size,
    });
    return NextResponse.json({ ok: true, upload });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "사진 업로드 URL을 발급하지 못했습니다." },
      { status: 400 },
    );
  }
}
