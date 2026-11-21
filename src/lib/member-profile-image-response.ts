import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { matchesIfNoneMatch } from "@/lib/http-conditional";

/**
 * 세션·관리자 인증 뒤 안정 URL로 내려주는 회원 프로필 사진 응답 규칙.
 *
 * 브라우저 개인 캐시에 보관하되(`private`) 매 사용 전에 서버에 재검증하게 해(`no-cache`)
 * 권한 확인·감사 로그는 매번 실행하고, 사진이 그대로면 Storage 다운로드 없이 304로 끝낸다.
 * 토큰 URL 라우트(wallet/mm/certification avatar)는 이 헬퍼를 쓰지 않고 `no-store`를 유지한다.
 */
export const MEMBER_PROFILE_IMAGE_CACHE_CONTROL = "private, no-cache";

export type MemberProfileImageVersion = {
  imageId: string;
  updatedAt: string | null;
};

export function createMemberProfileImageEntityTag(image: MemberProfileImageVersion) {
  return `"${createHash("sha256")
    .update(`${image.imageId}:${image.updatedAt ?? ""}`)
    .digest("hex")}"`;
}

export function getMemberProfileImageRevalidation(
  request: Request,
  image: MemberProfileImageVersion,
) {
  const etag = createMemberProfileImageEntityTag(image);
  const headers = {
    "cache-control": MEMBER_PROFILE_IMAGE_CACHE_CONTROL,
    etag,
    // 같은 URL이 로그인한 회원에 따라 다른 사진을 돌려줄 수 있다.
    vary: "Cookie",
    "x-content-type-options": "nosniff",
  };
  const notModified = matchesIfNoneMatch(request.headers.get("if-none-match"), etag)
    ? new NextResponse(null, { status: 304, headers })
    : null;
  return { headers, notModified };
}

export function createMemberProfileImageResponse(
  body: Buffer,
  headers: ReturnType<typeof getMemberProfileImageRevalidation>["headers"],
) {
  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": "image/webp",
      "content-length": String(body.byteLength),
      ...headers,
    },
  });
}
