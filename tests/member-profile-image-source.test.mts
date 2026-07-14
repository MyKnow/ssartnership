import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_MEMBER_PROFILE_IMAGE_SOURCE_BYTES,
  parseMemberProfileImageUrl,
  resolveMemberProfileImageData,
} from "@/lib/member-profile-images";

test("Mattermost 프로필 사진 URL은 공개 HTTP(S) URL만 허용한다", () => {
  const valid = parseMemberProfileImageUrl(
    "https://verify.example.com/profile/avatar?signature=abc#preview",
  );

  assert.equal(valid?.toString(), "https://verify.example.com/profile/avatar?signature=abc");
  assert.equal(parseMemberProfileImageUrl("ftp://example.com/avatar.png"), null);
  assert.equal(parseMemberProfileImageUrl("https://user:pass@example.com/avatar.png"), null);
  assert.equal(parseMemberProfileImageUrl("https://example.com/" + "a".repeat(2_001)), null);
});

test("Base64가 없으면 Mattermost 프로필 사진 URL을 5MB 한도로 수집한다", async () => {
  const requested = {
    url: null as URL | null,
    maxBytes: undefined as number | undefined,
  };

  const result = await resolveMemberProfileImageData(
    {
      avatarBase64: null,
      avatarContentType: null,
      avatarUrl: "https://verify.example.com/profile/avatar?signature=abc",
    },
    {
      fetchPublicImage: async (url, options) => {
        requested.url = url;
        requested.maxBytes = options?.maxBytes;
        return {
          body: Buffer.from("image-bytes"),
          contentType: "image/png; charset=binary",
        };
      },
    },
  );

  assert.equal(requested.url?.hostname, "verify.example.com");
  assert.equal(requested.maxBytes, MAX_MEMBER_PROFILE_IMAGE_SOURCE_BYTES);
  assert.equal(result?.contentType, "image/png");
  assert.equal(result?.source.toString("utf8"), "image-bytes");
});

test("유효한 Base64 프로필 사진은 URL 수집보다 우선한다", async () => {
  let fetchCalled = false;
  const result = await resolveMemberProfileImageData(
    {
      avatarBase64: "data:image/png;base64,aGVsbG8=",
      avatarContentType: null,
      avatarUrl: "https://verify.example.com/profile/avatar",
    },
    {
      fetchPublicImage: async () => {
        fetchCalled = true;
        throw new Error("should not fetch");
      },
    },
  );

  assert.equal(fetchCalled, false);
  assert.equal(result?.contentType, "image/png");
  assert.equal(result?.source.toString("utf8"), "hello");
});

test("지원하지 않는 외부 이미지 형식과 안전하지 않은 URL은 저장 후보에서 제외한다", async () => {
  let fetchCalled = false;
  const invalidUrlResult = await resolveMemberProfileImageData(
    {
      avatarBase64: null,
      avatarContentType: null,
      avatarUrl: "http://127.0.0.1/avatar.png",
    },
    {
      fetchPublicImage: async () => {
        fetchCalled = true;
        throw new Error("should not fetch");
      },
    },
  );
  assert.equal(invalidUrlResult, null);
  assert.equal(fetchCalled, false);

  const unsupportedTypeResult = await resolveMemberProfileImageData(
    {
      avatarBase64: null,
      avatarContentType: null,
      avatarUrl: "https://verify.example.com/profile/avatar",
    },
    {
      fetchPublicImage: async () => ({
        body: Buffer.from("<svg />"),
        contentType: "image/svg+xml",
      }),
    },
  );
  assert.equal(unsupportedTypeResult, null);
});
