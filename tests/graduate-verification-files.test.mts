import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  inspectGraduateCertificatePdf,
  normalizeGraduateProfileImage,
} from "@/lib/graduate-verification-files";

test("수료증 PDF는 매직 바이트, 페이지 수 및 위험 기능을 검사한다", async () => {
  const safePdf = Buffer.from(
    "%PDF-1.7\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R >>\nendobj\n%%EOF",
    "utf8",
  );
  const result = await inspectGraduateCertificatePdf(safePdf);
  assert.equal(result.hasPdfMagicBytes, true);
  assert.equal(result.pageCount, 1);
  assert.equal(result.isEncrypted, false);
  assert.equal(result.hasJavaScript, false);
  assert.equal(result.hasAttachments, false);

  const unsafePdf = Buffer.from("%PDF-1.7\n/Encrypt /JavaScript /EmbeddedFile /Type /Page", "utf8");
  const unsafe = await inspectGraduateCertificatePdf(unsafePdf);
  assert.equal(unsafe.isEncrypted, true);
  assert.equal(unsafe.hasJavaScript, true);
  assert.equal(unsafe.hasAttachments, true);
});

test("본인 사진은 서버에서 640 정사각 WebP로 다시 인코딩하고 메타데이터를 제거한다", async () => {
  const original = await sharp({
    create: {
      width: 960,
      height: 960,
      channels: 3,
      background: { r: 60, g: 120, b: 180 },
    },
  })
    .withMetadata({
      exif: { IFD0: { Copyright: "synthetic-metadata" } },
    })
    .jpeg()
    .toBuffer();

  const result = await normalizeGraduateProfileImage({
    contentType: "image/jpeg",
    source: original,
  });
  const metadata = await sharp(result.buffer).metadata();

  assert.equal(result.contentType, "image/webp");
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 640);
  assert.equal(metadata.height, 640);
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.icc, undefined);
});

test("손상되었거나 GIF·SVG처럼 허용하지 않은 이미지 입력은 서버에서 거부한다", async () => {
  await assert.rejects(
    normalizeGraduateProfileImage({
      contentType: "image/gif",
      source: Buffer.from("GIF89a", "ascii"),
    }),
    /JPEG, PNG, WebP/,
  );
  await assert.rejects(
    normalizeGraduateProfileImage({
      contentType: "image/png",
      source: Buffer.from("not-an-image", "utf8"),
    }),
    /사진 파일/,
  );
});
