import { NextResponse } from "next/server";
import { downloadPrivateMemberProfileImage } from "@/lib/graduate-verification-storage";
import { getActiveMemberProfileImage } from "@/lib/member-profile-images";
import { getSignedUserSession } from "@/lib/user-auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSignedUserSession();
  if (!session?.userId) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  const image = await getActiveMemberProfileImage(session.userId, {
    requirePasswordSetup: true,
  });
  if (!image) {
    return NextResponse.json({ message: "본인 사진을 찾을 수 없습니다." }, { status: 404 });
  }
  const body = await downloadPrivateMemberProfileImage(image.storagePath);
  if (!body) return NextResponse.json({ message: "본인 사진을 불러오지 못했습니다." }, { status: 404 });
  return new NextResponse(body, {
    headers: {
      "content-type": "image/webp",
      "content-length": String(body.byteLength),
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
