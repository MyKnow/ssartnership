import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ensureAdminApiPermission } from "@/lib/admin-access";
import { logAdminDataUnavailable } from "@/lib/admin-observability";
import { downloadPrivateMemberProfileImage } from "@/lib/graduate-verification-storage";
import { getActiveMemberProfileImage } from "@/lib/member-profile-images";
import {
  createMemberProfileImageResponse,
  getMemberProfileImageRevalidation,
} from "@/lib/member-profile-image-response";
import { withServerTiming } from "@/lib/server-timing";

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
  return withServerTiming(async (timing) => {
    const accessDenied = await timing.measure("auth", () =>
      ensureAdminApiPermission(request, "members", "read"),
    );
    if (accessDenied) {
      return accessDenied;
    }

    const { id } = await context.params;
    if (!isUuid(id)) {
      return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
    }

    let image: Awaited<ReturnType<typeof getActiveMemberProfileImage>>;
    try {
      image = await timing.measure("query", () =>
        getActiveMemberProfileImage(id),
      );
    } catch (error) {
      logAdminDataUnavailable("admin-member-avatar-query", error);
      return NextResponse.json(
        { message: "아바타를 불러오지 못했습니다." },
        { status: 503 },
      );
    }
    if (!image) {
      return NextResponse.json(
        { message: "아바타를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const revalidation = getMemberProfileImageRevalidation(request, image);
    if (revalidation.notModified) {
      return revalidation.notModified;
    }

    let body: Awaited<ReturnType<typeof downloadPrivateMemberProfileImage>>;
    try {
      body = await timing.measure("storage", () =>
        downloadPrivateMemberProfileImage(image.storagePath),
      );
    } catch (error) {
      logAdminDataUnavailable("admin-member-avatar-storage", error);
      return NextResponse.json(
        { message: "아바타를 불러오지 못했습니다." },
        { status: 503 },
      );
    }
    if (!body) {
      return NextResponse.json(
        { message: "아바타를 불러오지 못했습니다." },
        { status: 404 },
      );
    }

    return createMemberProfileImageResponse(body, revalidation.headers);
  });
}
