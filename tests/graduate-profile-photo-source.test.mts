import assert from "node:assert/strict";
import test from "node:test";
import {
  GRADUATE_PROFILE_PHOTO_ACCEPT,
  getGraduateProfileHeifSpatialExtentError,
  getGraduateProfilePhotoPixelError,
  getGraduateProfilePhotoSourceError,
  getGraduateProfilePhotoSourceFormat,
} from "@/lib/graduate-profile-photo.client";

function source(name: string, type: string, size = 1_024) {
  return { name, type, size };
}

function box(type: string, payload = new Uint8Array()) {
  const result = new Uint8Array(8 + payload.length);
  const view = new DataView(result.buffer);
  view.setUint32(0, result.length);
  for (let index = 0; index < type.length; index += 1) {
    result[4 + index] = type.charCodeAt(index);
  }
  result.set(payload, 8);
  return result;
}

function joinBoxes(...boxes: Uint8Array[]) {
  const result = new Uint8Array(boxes.reduce((total, item) => total + item.length, 0));
  let offset = 0;
  for (const item of boxes) {
    result.set(item, offset);
    offset += item.length;
  }
  return result;
}

function spatialExtent(width: number, height: number) {
  const payload = new Uint8Array(12);
  const view = new DataView(payload.buffer);
  view.setUint32(4, width);
  view.setUint32(8, height);
  return box("ispe", payload);
}

function heifWithSpatialExtents(...extents: Uint8Array[]) {
  const ipco = box("ipco", joinBoxes(...extents));
  const iprp = box("iprp", ipco);
  const meta = box("meta", joinBoxes(new Uint8Array(4), iprp));
  return joinBoxes(box("ftyp", new Uint8Array(12)), meta).buffer;
}

test("휴대폰 갤러리의 JPEG·PNG·WebP·HEIC·HEIF 원본을 명시적으로 식별한다", () => {
  assert.equal(
    getGraduateProfilePhotoSourceFormat(source("IMG_0001.JPG", "image/jpeg")),
    "jpeg",
  );
  assert.equal(
    getGraduateProfilePhotoSourceFormat(source("camera.png", "image/png")),
    "png",
  );
  assert.equal(
    getGraduateProfilePhotoSourceFormat(source("camera.webp", "image/webp")),
    "webp",
  );
  assert.equal(
    getGraduateProfilePhotoSourceFormat(source("IMG_0002.HEIC", "image/heic")),
    "heif",
  );
  assert.equal(
    getGraduateProfilePhotoSourceFormat(source("IMG_0003.heif", "image/heif")),
    "heif",
  );
  assert.equal(
    getGraduateProfilePhotoSourceFormat(source("IMG_0004.heic", "")),
    "heif",
  );
  assert.equal(
    getGraduateProfilePhotoSourceFormat(
      source("IMG_0005.HEIC", "application/octet-stream"),
    ),
    "heif",
  );
});

test("선언 형식과 확장자가 충돌하거나 지원하지 않는 이미지 형식은 선택 단계에서 막는다", () => {
  assert.equal(
    getGraduateProfilePhotoSourceFormat(source("photo.heic", "image/jpeg")),
    null,
  );
  assert.equal(
    getGraduateProfilePhotoSourceFormat(source("photo.jpg", "image/avif")),
    null,
  );
  assert.equal(
    getGraduateProfilePhotoSourceFormat(source("photo.svg", "image/svg+xml")),
    null,
  );
  assert.equal(
    getGraduateProfilePhotoSourceFormat(source("photo.gif", "image/gif")),
    null,
  );
  assert.match(
    getGraduateProfilePhotoSourceError(source("photo.avif", "image/avif")) ?? "",
    /JPEG, PNG, WebP, HEIC, HEIF/,
  );
});

test("선택 단계는 서버와 같은 5MB 입력 상한을 적용하고 image 전체 허용을 사용하지 않는다", () => {
  assert.match(
    getGraduateProfilePhotoSourceError(
      source("IMG_0001.HEIC", "image/heic", 5 * 1024 * 1024 + 1),
    ) ?? "",
    /5MB/,
  );
  assert.equal(GRADUATE_PROFILE_PHOTO_ACCEPT.includes("image/*"), false);
  assert.match(GRADUATE_PROFILE_PHOTO_ACCEPT, /\.heic/);
  assert.match(GRADUATE_PROFILE_PHOTO_ACCEPT, /\.heif/);
});

test("HEIC/HEIF 디코드 결과는 서버와 같은 최대 픽셀 수를 넘길 수 없다", () => {
  assert.equal(getGraduateProfilePhotoPixelError(5_000, 5_000), null);
  assert.match(
    getGraduateProfilePhotoPixelError(5_001, 5_000) ?? "",
    /2,500만 픽셀/,
  );
});

test("HEIC/HEIF 컨테이너의 ispe 해상도를 디코더 실행 전에 제한한다", () => {
  assert.equal(
    getGraduateProfileHeifSpatialExtentError(
      heifWithSpatialExtents(spatialExtent(5_000, 5_000)),
    ),
    null,
  );
  assert.match(
    getGraduateProfileHeifSpatialExtentError(
      heifWithSpatialExtents(spatialExtent(5_001, 5_000)),
    ) ?? "",
    /2,500만 픽셀/,
  );
  assert.match(
    getGraduateProfileHeifSpatialExtentError(box("mdat", spatialExtent(100, 100)).buffer) ?? "",
    /해상도를 확인하지 못했습니다/,
  );
});
