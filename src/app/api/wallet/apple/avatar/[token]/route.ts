import { NextResponse } from "next/server";
import { downloadPrivateMemberProfileImage } from "@/lib/graduate-verification-storage";
import { getActiveMemberProfileImage } from "@/lib/member-profile-images";
import { getMockMemberProfileImageUrl, isMockDataSource } from "@/lib/mock/member";
import {
  decodeWalletPassTokenSegment,
  resolveWalletVerifyState,
} from "@/app/(site)/wallet/verify/[token]/verify-state";

export const runtime = "nodejs";

const PRIVATE_AVATAR_RESPONSE_HEADERS = {
  "cache-control": "private, no-store",
  "x-content-type-options": "nosniff",
  "x-robots-tag": "noindex, nofollow",
} as const;

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { message },
    {
      status,
      headers: PRIVATE_AVATAR_RESPONSE_HEADERS,
    },
  );
}

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const rawToken = decodeWalletPassTokenSegment(token);
  const state = await resolveWalletVerifyState(rawToken);

  if (state.kind === "invalid") {
    return jsonError("유효하지 않은 Apple Wallet 패스입니다.", 404);
  }
  if (state.kind === "revoked") {
    return jsonError("폐기된 Apple Wallet 패스입니다.", 410);
  }
  if (state.kind === "ineligible") {
    return jsonError("현재 자격으로는 프로필 사진을 확인할 수 없습니다.", 403);
  }
  if (state.kind === "consent_required") {
    return jsonError("Wallet 데이터 이용 재동의가 필요합니다.", 403);
  }
  if (state.kind === "outdated") {
    return jsonError("최신 회원 정보와 일치하지 않는 패스입니다.", 409);
  }

  if (isMockDataSource()) {
    return NextResponse.redirect(
      new URL(getMockMemberProfileImageUrl(), request.url),
      {
        headers: PRIVATE_AVATAR_RESPONSE_HEADERS,
      },
    );
  }

  const image = await getActiveMemberProfileImage(state.member.id, {
    requirePasswordSetup: true,
  });
  if (!image) {
    return jsonError("현재 승인된 프로필 사진을 찾을 수 없습니다.", 404);
  }

  const body = await downloadPrivateMemberProfileImage(image.storagePath);
  if (!body) {
    return jsonError("프로필 사진을 불러오지 못했습니다.", 404);
  }

  return new NextResponse(body, {
    headers: {
      ...PRIVATE_AVATAR_RESPONSE_HEADERS,
      "content-type": "image/webp",
      "content-length": String(body.byteLength),
    },
  });
}
