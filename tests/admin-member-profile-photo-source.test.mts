import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_MEMBER_PROFILE_PHOTO_ACCEPT,
  getAdminMemberProfilePhotoSourceError,
  isAdminMemberProfilePhotoHeifSource,
} from "@/lib/admin-member-profile-photo.client";

function source(name: string, type: string, size = 1_024) {
  return { name, type, size };
}

test("관리자 사진 선택기는 HEIC/HEIF를 포함한 공통 확장자 목록을 명시한다", () => {
  assert.match(ADMIN_MEMBER_PROFILE_PHOTO_ACCEPT, /image\/heic/);
  assert.match(ADMIN_MEMBER_PROFILE_PHOTO_ACCEPT, /\.heif/);
  assert.doesNotMatch(ADMIN_MEMBER_PROFILE_PHOTO_ACCEPT, /^image\/\*$/);
  assert.equal(
    getAdminMemberProfilePhotoSourceError(source("gallery-photo.avif", "image/avif")),
    null,
  );
  assert.equal(
    getAdminMemberProfilePhotoSourceError(source("camera-export", "")),
    null,
  );
  assert.equal(
    getAdminMemberProfilePhotoSourceError(source("IMG_0001.HEIC", "application/octet-stream")),
    null,
  );
});

test("관리자 사진 선택기는 SVG를 공통 서버 래스터화 대상으로 넘기고 비이미지·과대 입력은 막는다", () => {
  assert.equal(
    getAdminMemberProfilePhotoSourceError(source("profile.svg", "image/svg+xml")),
    null,
  );
  assert.equal(
    getAdminMemberProfilePhotoSourceError(source("profile.svg", "image/svg+xml; charset=utf-8")),
    null,
  );
  assert.match(
    getAdminMemberProfilePhotoSourceError(source("profile.jpg", "text/plain")) ?? "",
    /이미지/,
  );
  assert.match(
    getAdminMemberProfilePhotoSourceError(
      source("profile.webp", "image/webp", 5 * 1024 * 1024 + 1),
    ) ?? "",
    /5MB/,
  );
});

test("HEIC·HEIF는 확장자가 다르거나 MIME이 비어도 브라우저 내 WebP 정규화 대상으로 식별한다", () => {
  assert.equal(isAdminMemberProfilePhotoHeifSource(source("IMG_0001.HEIC", "")), true);
  assert.equal(isAdminMemberProfilePhotoHeifSource(source("IMG_0002.heif", "application/octet-stream")), true);
  assert.equal(isAdminMemberProfilePhotoHeifSource(source("profile.avif", "image/avif")), false);
});
