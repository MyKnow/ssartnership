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

test("관리자 사진 선택기는 파일 확장자 목록 대신 image/*를 열고 브라우저가 해독 가능한 래스터 이미지를 허용한다", () => {
  assert.equal(ADMIN_MEMBER_PROFILE_PHOTO_ACCEPT, "image/*");
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

test("관리자 사진 선택기는 SVG·비이미지·과대 입력을 서버 업로드 전에 차단한다", () => {
  assert.match(
    getAdminMemberProfilePhotoSourceError(source("profile.svg", "image/svg+xml")) ?? "",
    /SVG/,
  );
  assert.match(
    getAdminMemberProfilePhotoSourceError(source("profile.svg", "image/svg+xml; charset=utf-8")) ?? "",
    /SVG/,
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
