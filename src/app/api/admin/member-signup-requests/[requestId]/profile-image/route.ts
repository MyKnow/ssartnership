import { NextResponse } from "next/server";
import { requireMemberSignupRequestAdmin } from "@/lib/admin-access";
import { getMattermostSignupApprovalProfileImageContext } from "@/lib/mm-signup-approval/repository";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";
import { withServerTiming } from "@/lib/server-timing";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  return withServerTiming(async (timing) => {
    const { requestId } = await params;
    if (!isUuid(requestId)) {
      return NextResponse.json({ message: "이미지를 찾을 수 없습니다." }, { status: 404 });
    }
    try {
      await timing.measure("auth", () => requireMemberSignupRequestAdmin("read", {
        path: "/admin/member-signup-requests",
      }));
      const context = await timing.measure("query", () => getMattermostSignupApprovalProfileImageContext(requestId));
      if (
        !context
        || context.status !== "pending"
        || context.expiresAt.getTime() <= Date.now()
        || !context.uploadId
      ) {
        return NextResponse.json({ message: "이미지를 찾을 수 없습니다." }, { status: 404 });
      }
      const { data: upload, error: uploadError } = await timing.measure("lookup", () => getSupabaseAdminClient()
        .from("image_upload_sessions")
        .select("storage_bucket,storage_path,status,content_type")
        .eq("id", context.uploadId)
        .eq("owner_kind", "signup")
        .eq("owner_id", context.ownerId)
        .eq("purpose", "member-signup-profile")
        .eq("role", "profile")
        .eq("status", "ready")
        .maybeSingle());
      if (uploadError || !upload || upload.content_type !== "image/webp") {
        return NextResponse.json({ message: "이미지를 찾을 수 없습니다." }, { status: 404 });
      }
      const { data: body, error: downloadError } = await timing.measure("storage", () => getSupabaseAdminClient().storage
        .from(upload.storage_bucket)
        .download(upload.storage_path));
      if (downloadError || !body) {
        return NextResponse.json({ message: "이미지를 불러오지 못했습니다." }, { status: 404 });
      }
      return new NextResponse(body, {
        headers: {
          "content-type": "image/webp",
          "cache-control": "private, no-store",
          "x-content-type-options": "nosniff",
        },
      });
    } catch {
      return NextResponse.json({ message: "이미지를 불러오지 못했습니다." }, { status: 403 });
    }
  });
}
