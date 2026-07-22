import { NextResponse } from "next/server";
import { verifyCertificationQrToken } from "@/lib/certification-qr";
import { downloadPrivateMemberProfileImage } from "@/lib/graduate-verification-storage";
import { getActiveMemberProfileImage } from "@/lib/member-profile-images";
import { getMockMemberProfileImageUrl, isMockDataSource } from "@/lib/mock/member";

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

  if (isMockDataSource()) {
    return NextResponse.redirect(
      new URL(getMockMemberProfileImageUrl(), _request.url),
    );
  }

  const image = await getActiveMemberProfileImage(verification.payload.userId, {
    requirePasswordSetup: true,
  });
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
    headers: {
      "content-type": "image/webp",
      "content-length": String(body.byteLength),
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
