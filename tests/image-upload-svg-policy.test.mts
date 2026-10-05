import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { gzipSync } from "node:zlib";
import sharp from "sharp";
import {
  IMAGE_SOURCE_ACCEPT,
  IMAGE_UPLOAD_PURPOSES,
  RASTER_IMAGE_SOURCE_ACCEPT,
  SVG_SOURCE_NOT_ALLOWED_MESSAGE,
  getImageSourceAccept,
  isSvgImageSource,
  resolveImageTransformPolicy,
  validateImageUploadSource,
  type ImageUploadPurpose,
} from "../src/lib/image-upload/policy.ts";
import {
  isGzipCompressedImageSource,
  looksLikeMarkupImageSource,
} from "../src/lib/image-upload/transform-core.ts";
import { normalizeImageUpload } from "../src/lib/image-upload/transform.server.ts";
import { PARTNER_REGISTRATION_IMAGE_ACCEPT } from "../src/lib/partner-registration.ts";

const ROLE_BY_PURPOSE: Record<ImageUploadPurpose, string[]> = {
  partner: ["thumbnail", "gallery"],
  "partner-registration": ["thumbnail", "gallery"],
  "partner-change-request": ["thumbnail", "gallery"],
  review: ["image"],
  profile: ["profile"],
  "member-signup-profile": ["profile"],
  "graduate-verification": ["profile"],
  "manual-member-import": ["profile"],
  promotion: ["slide"],
  "showcase-project": ["image"],
};

// 관리자·파트너 업로드만 SVG 원본을 받는다.
const SVG_ALLOWED = new Set<ImageUploadPurpose>([
  "partner",
  "partner-change-request",
  "promotion",
  "manual-member-import",
]);

const SAFE_SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"><rect width="40" height="30" fill="#123456"/></svg>',
  "utf8",
);

test("게스트·회원 업로드 용도는 SVG 원본을 받지 않고 관리자·파트너 용도만 허용한다", () => {
  for (const purpose of IMAGE_UPLOAD_PURPOSES) {
    for (const role of ROLE_BY_PURPOSE[purpose]) {
      const policy = resolveImageTransformPolicy(purpose, role);
      assert.equal(policy.allowSvgSource, SVG_ALLOWED.has(purpose), policy.key);
    }
  }
});

test("FE·BE 공용 원본 검증은 SVG 금지 용도에서 MIME이나 확장자가 SVG면 거부한다", () => {
  const review = resolveImageTransformPolicy("review", "image");
  const promotion = resolveImageTransformPolicy("promotion", "slide");

  assert.equal(isSvgImageSource({ name: "logo.SVG", type: "" }), true);
  assert.equal(isSvgImageSource({ name: "logo.png", type: "image/svg+xml" }), true);
  assert.equal(isSvgImageSource({ name: "photo.jpg", type: "image/jpeg" }), false);
  assert.equal(
    validateImageUploadSource({ name: "logo.svg", type: "image/svg+xml", size: 100 }, review),
    SVG_SOURCE_NOT_ALLOWED_MESSAGE,
  );
  assert.equal(
    validateImageUploadSource({ name: "logo.svg", type: "", size: 100 }, review),
    SVG_SOURCE_NOT_ALLOWED_MESSAGE,
  );
  assert.equal(
    validateImageUploadSource({ name: "logo.svg", type: "image/svg+xml", size: 100 }, promotion),
    null,
  );
  assert.equal(
    validateImageUploadSource({ name: "photo.jpg", type: "image/jpeg", size: 100 }, review),
    null,
  );
});

test("파일 선택 accept는 정책에 맞춰 SVG를 빼거나 유지한다", () => {
  assert.doesNotMatch(RASTER_IMAGE_SOURCE_ACCEPT, /svg/);
  assert.match(RASTER_IMAGE_SOURCE_ACCEPT, /image\/heic/);
  assert.match(IMAGE_SOURCE_ACCEPT, /image\/svg\+xml/);
  assert.equal(getImageSourceAccept(resolveImageTransformPolicy("review", "image")), RASTER_IMAGE_SOURCE_ACCEPT);
  assert.equal(getImageSourceAccept(resolveImageTransformPolicy("partner", "thumbnail")), IMAGE_SOURCE_ACCEPT);
  assert.equal(PARTNER_REGISTRATION_IMAGE_ACCEPT, RASTER_IMAGE_SOURCE_ACCEPT);
});

test("서버 변환은 SVG 금지 용도에서 선언 MIME을 속인 SVG 바이트도 래스터라이저 전에 거부한다", async () => {
  assert.equal(looksLikeMarkupImageSource(SAFE_SVG), true);
  assert.equal(looksLikeMarkupImageSource(Buffer.from("﻿  \n<?xml version=\"1.0\"?><svg/>", "utf8")), true);
  assert.equal(looksLikeMarkupImageSource(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), false);

  for (const declaredContentType of ["image/svg+xml", "image/png"]) {
    await assert.rejects(
      normalizeImageUpload({
        source: SAFE_SVG,
        declaredContentType,
        policy: resolveImageTransformPolicy("review", "image"),
      }),
      /지원하지 않는 이미지 형식입니다/,
    );
  }

  const promoted = await normalizeImageUpload({
    source: SAFE_SVG,
    declaredContentType: "image/svg+xml",
    policy: resolveImageTransformPolicy("promotion", "slide"),
  });
  assert.equal(promoted.contentType, "image/webp");
});

test("gzip으로 감싼 SVG(SVGZ)는 마크업 검사를 피해도 용도와 무관하게 librsvg 파싱 전에 거부한다", async () => {
  const svgz = gzipSync(SAFE_SVG);
  // libvips는 SVGZ를 SVG로 인식해 metadata()에서 librsvg로 파싱한다. 그래서 바이트 단계에서 막아야 한다.
  assert.equal((await sharp(svgz).metadata()).format, "svg");
  assert.equal(looksLikeMarkupImageSource(svgz), false);
  assert.equal(isGzipCompressedImageSource(svgz), true);
  assert.equal(isGzipCompressedImageSource(Buffer.from([0x1f])), false);
  for (const raster of [
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    Buffer.from("RIFF0000WEBP", "latin1"),
    Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]),
  ]) {
    assert.equal(isGzipCompressedImageSource(raster), false);
  }

  // librsvg가 헤더를 파싱하면 픽셀 상한 오류("이미지 파일을 처리할 수 없습니다")가 난다. 형식 거부 문구가
  // 나오면 파싱 전에 바이트 단계에서 막혔다는 뜻이다.
  const oversizedSvgz = gzipSync(
    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="20000" height="20000"><rect width="10" height="10"/></svg>',
      "utf8",
    ),
  );
  const cases: Array<[ImageUploadPurpose, string, string]> = [
    ["review", "image", "image/png"],
    ["partner-registration", "thumbnail", "image/jpeg"],
    ["profile", "profile", "image/heic"],
    ["promotion", "slide", "image/svg+xml"],
    ["partner", "thumbnail", "image/png"],
  ];
  for (const source of [svgz, oversizedSvgz]) {
    for (const [purpose, role, declaredContentType] of cases) {
      await assert.rejects(
        normalizeImageUpload({
          source,
          declaredContentType,
          policy: resolveImageTransformPolicy(purpose, role),
        }),
        /지원하지 않는 이미지 형식입니다/,
        `${purpose}-${role} ${declaredContentType}`,
      );
    }
  }
});

test("게스트·회원 사진 입력은 정책 기반 accept를 쓴다", async () => {
  const sources = await Promise.all(
    [
      ["../src/components/review-media/ReviewImageUploader.tsx", "REVIEW_IMAGE_POLICY"],
      ["../src/components/graduate-verification/GraduateProfilePhotoForm.tsx", "PROFILE_IMAGE_POLICY"],
      ["../src/components/graduate-verification/GraduateVerificationApplicationView.tsx", "GRADUATE_PROFILE_IMAGE_POLICY"],
      ["../src/components/project-showcase/ShowcaseProjectForm.tsx", "IMAGE_POLICY"],
    ].map(async ([path, policyName]) => ({
      policyName,
      source: await readFile(new URL(path, import.meta.url), "utf8"),
    })),
  );
  for (const { policyName, source } of sources) {
    assert.ok(source.includes(`accept={getImageSourceAccept(${policyName})}`), policyName);
    assert.doesNotMatch(source, /accept=\{IMAGE_SOURCE_ACCEPT\}/);
  }
});
