import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ensureAdminApiPermission } from "@/lib/admin-access";
import { downloadPrivateMemberProfileImage } from "@/lib/graduate-verification-storage";
import { syncMemberMattermostProfile } from "@/lib/member-mattermost-profile-sync";
import { getActiveMemberProfileImage } from "@/lib/member-profile-images";

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
  const accessDenied = await ensureAdminApiPermission(request, "members", "read");
  if (accessDenied) {
    return accessDenied;
  }

  const { id } = await context.params;
  if (!isUuid(id)) {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }

  let image = await getActiveMemberProfileImage(id);
  if (!image) {
    try {
      await syncMemberMattermostProfile(id);
      image = await getActiveMemberProfileImage(id);
    } catch {
      console.warn("[admin-member-avatar] profile sync failed");
    }
  }
  if (!image) {
    return NextResponse.json(
      { message: "아바타를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const body = await downloadPrivateMemberProfileImage(image.storagePath);
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
