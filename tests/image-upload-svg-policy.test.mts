import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
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
import { looksLikeMarkupImageSource } from "../src/lib/image-upload/transform-core.ts";
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
