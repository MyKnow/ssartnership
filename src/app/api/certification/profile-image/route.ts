import { NextResponse } from "next/server";
import { downloadPrivateMemberProfileImage } from "@/lib/graduate-verification-storage";
import { getActiveMemberProfileImage } from "@/lib/member-profile-images";
import {
  createMemberProfileImageResponse,
  getMemberProfileImageRevalidation,
} from "@/lib/member-profile-image-response";
import { getSignedUserSession } from "@/lib/user-auth";
import { getMockMemberProfileImageUrl, isMockDataSource } from "@/lib/mock/member";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getSignedUserSession();
  if (!session?.userId) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  if (isMockDataSource()) {
    return NextResponse.redirect(
      new URL(getMockMemberProfileImageUrl(), request.url),
    );
  }
  const image = await getActiveMemberProfileImage(session.userId, {
    requirePasswordSetup: true,
  });
  if (!image) {
    return NextResponse.json({ message: "본인 사진을 찾을 수 없습니다." }, { status: 404 });
  }
  const revalidation = getMemberProfileImageRevalidation(request, image);
  if (revalidation.notModified) {
    return revalidation.notModified;
  }
  const body = await downloadPrivateMemberProfileImage(image.storagePath);
  if (!body) return NextResponse.json({ message: "본인 사진을 불러오지 못했습니다." }, { status: 404 });
  return createMemberProfileImageResponse(body, revalidation.headers);
}
