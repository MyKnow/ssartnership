import assert from "node:assert/strict";
import test from "node:test";
import { deflateSync } from "node:zlib";
import { PDFDocument, PDFName, PDFString } from "pdf-lib";
import sharp from "sharp";
import {
  decodePdfNameEscapes,
  inspectGraduateCertificatePdf,
  stripPdfStreamBodies,
  normalizeMattermostProfileImage,
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

async function createSinglePagePdf() {
  const document = await PDFDocument.create();
  document.addPage([200, 200]);
  return document;
}

test("pdf-lib로 만든 일반 수료증 PDF는 압축 객체 스트림이어도 안전으로 판정한다", async () => {
  const document = await createSinglePagePdf();
  const result = await inspectGraduateCertificatePdf(
    Buffer.from(await document.save({ useObjectStreams: true })),
  );

  assert.equal(result.isParseable, true);
  assert.equal(result.pageCount, 1);
  assert.equal(result.hasJavaScript, false);
  assert.equal(result.hasAttachments, false);
  assert.equal(result.isEncrypted, false);
});

test("압축 객체 스트림 안의 JavaScript 동작은 원문 정규식에 보이지 않아도 구조 검사로 거부한다", async () => {
  const document = await createSinglePagePdf();
  document.catalog.set(
    PDFName.of("OpenAction"),
    document.context.obj({
      S: "JavaScript",
      JS: PDFString.of("app.alert(1)"),
    }),
  );
  const bytes = Buffer.from(await document.save({ useObjectStreams: true }));

  assert.doesNotMatch(bytes.toString("latin1"), /\/JavaScript/);
  const result = await inspectGraduateCertificatePdf(bytes);
  assert.equal(result.isParseable, true);
  assert.equal(result.hasJavaScript, true);
});

test("이름 이스케이프로 숨긴 JavaScript와 압축된 첨부 파일도 거부한다", async () => {
  const scripted = await createSinglePagePdf();
  scripted.catalog.set(
    PDFName.of("OpenAction"),
    scripted.context.obj({ S: "JavaScript", JS: PDFString.of("app.alert(1)") }),
  );
  const escaped = Buffer.from(
    Buffer.from(await scripted.save({ useObjectStreams: false }))
      .toString("latin1")
      .replaceAll("/JavaScript", "/J#61vaScript")
      .replaceAll("/JS ", "/#4a#53 "),
    "latin1",
  );
  assert.doesNotMatch(escaped.toString("latin1"), /\/JavaScript/);
  assert.equal((await inspectGraduateCertificatePdf(escaped)).hasJavaScript, true);
  assert.equal(decodePdfNameEscapes("/J#61vaScript"), "/JavaScript");

  const attached = await createSinglePagePdf();
  await attached.attach(Buffer.from("payload"), "payload.txt", {
    mimeType: "text/plain",
  });
  const attachment = await inspectGraduateCertificatePdf(
    Buffer.from(await attached.save({ useObjectStreams: true })),
  );
  assert.equal(attachment.hasAttachments, true);
});

test("Type 이름을 이스케이프해 pdf-lib가 펼치지 않은 객체 스트림도 디코딩해 검사한다", async () => {
  const header = "4 0\n";
  const objectStream = deflateSync(
    Buffer.from(`${header}<< /S /JavaScript /JS (app.alert(1)) >>`, "latin1"),
  );
  const prefix = [
    "%PDF-1.7",
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R /OpenAction 4 0 R >>\nendobj",
    "2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 10 10] >>\nendobj",
    `5 0 obj\n<< /Type /Ob#6aStm /N 1 /First ${header.length} /Filter /FlateDecode /Length ${objectStream.length} >>\nstream\n`,
  ].join("\n");
  const suffix = "\nendstream\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF";
  const pdf = Buffer.concat([
    Buffer.from(prefix, "latin1"),
    objectStream,
    Buffer.from(suffix, "latin1"),
  ]);

  const result = await inspectGraduateCertificatePdf(pdf);
  assert.equal(result.pageCount, 1);
  assert.equal(result.hasJavaScript, true);
});

test("파일 원문 검사는 이미지·폰트 stream 본문의 이진 데이터를 제외한다", () => {
  const text = "1 0 obj\n<< /Length 6 >>\nstream\n/JS x \nendstream\nendobj\n/Launch";
  const stripped = stripPdfStreamBodies(text);
  assert.doesNotMatch(stripped, /\/JS/);
  assert.match(stripped, /\/Launch/);
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

test("Mattermost 프로필 사진도 공통 WebP 변환 정책을 사용한다", async () => {
  const source = await sharp({
    create: {
      width: 96,
      height: 72,
      channels: 3,
      background: { r: 40, g: 140, b: 160 },
    },
  }).png().toBuffer();

  const result = await normalizeMattermostProfileImage({
    contentType: "image/png",
    source,
  });
  const metadata = await sharp(result.buffer).metadata();

  assert.equal(result.contentType, "image/webp");
  assert.equal(metadata.width, 640);
  assert.equal(metadata.height, 640);
});

test("관리자 수료증 원본 응답은 inline 대신 attachment와 sandbox CSP로 제공한다", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(
    new URL(
      "../src/app/api/admin/graduate-verifications/[requestId]/certificate/route.ts",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(source, /"content-disposition": 'attachment; filename="graduate-certificate\.pdf"'/);
  assert.match(source, /"content-security-policy": "sandbox; default-src 'none'"/);
  assert.doesNotMatch(source, /inline; filename=/);
});
