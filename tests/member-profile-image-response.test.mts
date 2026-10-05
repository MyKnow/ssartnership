import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { matchesIfNoneMatch } from "../src/lib/http-conditional.ts";
import {
  MEMBER_PROFILE_IMAGE_CACHE_CONTROL,
  createMemberProfileImageEntityTag,
  createMemberProfileImageResponse,
  getMemberProfileImageRevalidation,
} from "../src/lib/member-profile-image-response.ts";

const IMAGE = { imageId: "11111111-1111-4111-8111-111111111111", updatedAt: "2026-10-05T00:00:00.000Z" };
const root = new URL("..", import.meta.url);

function requestWith(ifNoneMatch?: string) {
  return new Request("https://example.test/api/certification/profile-image", {
    headers: ifNoneMatch ? { "If-None-Match": ifNoneMatch } : {},
  });
}

test("If-None-Match는 쉼표 목록·약한 태그·와일드카드를 약한 비교로 판정한다", () => {
  assert.equal(matchesIfNoneMatch(null, '"a"'), false);
  assert.equal(matchesIfNoneMatch("", '"a"'), false);
  assert.equal(matchesIfNoneMatch('"a"', '"a"'), true);
  assert.equal(matchesIfNoneMatch('"b", "a"', '"a"'), true);
  assert.equal(matchesIfNoneMatch('W/"a"', '"a"'), true);
  assert.equal(matchesIfNoneMatch('"a"', 'W/"a"'), true);
  assert.equal(matchesIfNoneMatch("*", '"a"'), true);
  assert.equal(matchesIfNoneMatch('"ab"', '"a"'), false);
  assert.equal(matchesIfNoneMatch(" , ", '"a"'), false);
});

test("프로필 사진 ETag는 이미지 ID와 갱신 시각이 바뀔 때만 달라진다", () => {
  const etag = createMemberProfileImageEntityTag(IMAGE);

  assert.match(etag, /^"[0-9a-f]{64}"$/);
  assert.equal(createMemberProfileImageEntityTag({ ...IMAGE }), etag);
  assert.notEqual(createMemberProfileImageEntityTag({ ...IMAGE, updatedAt: null }), etag);
  assert.notEqual(
    createMemberProfileImageEntityTag({ ...IMAGE, imageId: "22222222-2222-4222-8222-222222222222" }),
    etag,
  );
});

test("재검증 헤더는 개인 캐시 보관·매번 재검증이고 일치하면 본문 없는 304를 돌려준다", async () => {
  const fresh = getMemberProfileImageRevalidation(requestWith(), IMAGE);
  assert.equal(fresh.notModified, null);
  assert.equal(fresh.headers["cache-control"], MEMBER_PROFILE_IMAGE_CACHE_CONTROL);
  assert.equal(MEMBER_PROFILE_IMAGE_CACHE_CONTROL, "private, no-cache");
  assert.equal(fresh.headers.vary, "Cookie");
  assert.equal(fresh.headers["x-content-type-options"], "nosniff");

  const cached = getMemberProfileImageRevalidation(requestWith(fresh.headers.etag), IMAGE);
  assert.ok(cached.notModified);
  assert.equal(cached.notModified.status, 304);
  assert.equal(cached.notModified.headers.get("etag"), fresh.headers.etag);
  assert.equal(cached.notModified.headers.get("content-type"), null);
  assert.equal(await cached.notModified.text(), "");

  const stale = getMemberProfileImageRevalidation(requestWith('"stale"'), IMAGE);
  assert.equal(stale.notModified, null);
});

test("사진 본문 응답은 WebP 길이와 재검증 헤더를 함께 싣는다", async () => {
  const { headers } = getMemberProfileImageRevalidation(requestWith(), IMAGE);
  const body = Buffer.from([1, 2, 3, 4]);
  const response = createMemberProfileImageResponse(body, headers);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/webp");
  assert.equal(response.headers.get("content-length"), "4");
  assert.equal(response.headers.get("etag"), headers.etag);
  assert.equal(response.headers.get("cache-control"), "private, no-cache");
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), new Uint8Array(body));
});

test("세션·관리자 인증 안정 URL 라우트만 공용 재검증 헬퍼를 쓰고 토큰 라우트는 no-store를 유지한다", async () => {
  const stableRoutes = await Promise.all(
    [
      "src/app/api/admin/members/[id]/avatar/route.ts",
      "src/app/api/admin/profile-photos/current/[memberId]/route.ts",
      "src/app/api/certification/profile-image/route.ts",
    ].map((path) => readFile(new URL(path, root), "utf8")),
  );
  for (const source of stableRoutes) {
    assert.match(source, /getMemberProfileImageRevalidation\(request, image\)/);
    assert.match(source, /if \(revalidation\.notModified\) \{\s*return revalidation\.notModified;/);
    assert.match(source, /createMemberProfileImageResponse\(body, revalidation\.headers\)/);
    assert.doesNotMatch(source, /"cache-control": "private, no-store"/);
    // 304 판정은 권한 확인과 회원 사진 조회 뒤, Storage 다운로드 전에 한다.
    assert.ok(
      source.indexOf("getMemberProfileImageRevalidation(request, image)")
        < source.indexOf("downloadPrivateMemberProfileImage(image.storagePath)"),
    );
  }

  const tokenRoutes = await Promise.all(
    [
      "src/app/api/wallet/apple/avatar/[token]/route.ts",
      "src/app/api/mm/avatar/route.ts",
      "src/app/api/certification/avatar/[token]/route.ts",
    ].map((path) => readFile(new URL(path, root), "utf8")),
  );
  for (const source of tokenRoutes) {
    assert.match(source, /"cache-control": "private, no-store"/);
    assert.doesNotMatch(source, /getMemberProfileImageRevalidation/);
  }
});
