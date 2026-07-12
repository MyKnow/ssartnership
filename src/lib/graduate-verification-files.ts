import { createHash } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import {
  GRADUATE_PROFILE_IMAGE_SIZE,
  MAX_GRADUATE_CERTIFICATE_BYTES,
  MAX_GRADUATE_PROFILE_IMAGE_BYTES,
  validateGraduatePhotoUpload,
} from "@/lib/graduate-verification";

const PDF_MAGIC = Buffer.from("%PDF-");
const PDF_SECURITY_MARKERS = {
  encrypted: /\/Encrypt\b/i,
  javaScript: /\/(?:JavaScript|JS)\b/i,
  attachments: /\/(?:EmbeddedFiles?|Filespec)\b/i,
} as const;

const PROFILE_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_PROFILE_IMAGE_PIXELS = 25_000_000;

type GraduateCertificateInspection = {
  hasPdfMagicBytes: boolean;
  pageCount: number;
  isEncrypted: boolean;
  hasJavaScript: boolean;
  hasAttachments: boolean;
  isParseable: boolean;
};

function hasPdfMagicBytes(source: Buffer) {
  const leading = source.subarray(0, 1024);
  const offset = leading.indexOf(PDF_MAGIC);
  return offset >= 0 && offset <= 32;
}

function getPdfSourceText(source: Buffer) {
  return source.toString("latin1");
}

export async function inspectGraduateCertificatePdf(
  source: Buffer,
): Promise<GraduateCertificateInspection> {
  const hasMagic = hasPdfMagicBytes(source);
  const text = getPdfSourceText(source);
  const isEncrypted = PDF_SECURITY_MARKERS.encrypted.test(text);
  const hasJavaScript = PDF_SECURITY_MARKERS.javaScript.test(text);
  const hasAttachments = PDF_SECURITY_MARKERS.attachments.test(text);

  if (!hasMagic || source.length === 0 || source.length > MAX_GRADUATE_CERTIFICATE_BYTES) {
    return {
      hasPdfMagicBytes: hasMagic,
      pageCount: 0,
      isEncrypted,
      hasJavaScript,
      hasAttachments,
      isParseable: false,
    };
  }

  try {
    const document = await PDFDocument.load(source, {
      ignoreEncryption: false,
      updateMetadata: false,
    });
    return {
      hasPdfMagicBytes: true,
      pageCount: document.getPageCount(),
      isEncrypted,
      hasJavaScript,
      hasAttachments,
      isParseable: true,
    };
  } catch {
    return {
      hasPdfMagicBytes: true,
      pageCount: 0,
      isEncrypted,
      hasJavaScript,
      hasAttachments,
      isParseable: false,
    };
  }
}

function getExpectedContentType(format: string | undefined) {
  if (format === "jpeg") return "image/jpeg";
  if (format === "png") return "image/png";
  if (format === "webp") return "image/webp";
  return null;
}

function getExtensionForContentType(contentType: string) {
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/png") return "png";
  return "webp";
}

export async function normalizeGraduateProfileImage(input: {
  contentType: string;
  source: Buffer;
}) {
  if (!PROFILE_CONTENT_TYPES.has(input.contentType)) {
    throw new Error("본인 사진은 JPEG, PNG, WebP 파일만 업로드할 수 있습니다.");
  }
  if (input.source.length === 0 || input.source.length > MAX_GRADUATE_PROFILE_IMAGE_BYTES) {
    throw new Error("본인 사진은 5MB 이하만 업로드할 수 있습니다.");
  }

  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(input.source, {
      animated: true,
      failOn: "error",
      limitInputPixels: MAX_PROFILE_IMAGE_PIXELS,
    }).metadata();
  } catch {
    throw new Error("올바른 사진 파일인지 확인해 주세요.");
  }

  const detectedContentType = getExpectedContentType(metadata.format);
  if (!detectedContentType || detectedContentType !== input.contentType) {
    throw new Error("본인 사진은 JPEG, PNG, WebP 파일만 업로드할 수 있습니다.");
  }

  const validationError = validateGraduatePhotoUpload({
    name: `profile.${getExtensionForContentType(detectedContentType)}`,
    type: detectedContentType,
    size: input.source.length,
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
    isAnimated: Boolean(metadata.pages && metadata.pages > 1),
  });
  if (validationError) {
    throw new Error(validationError);
  }

  try {
    const buffer = await sharp(input.source, {
      animated: false,
      failOn: "error",
      limitInputPixels: MAX_PROFILE_IMAGE_PIXELS,
    })
      .rotate()
      .resize(GRADUATE_PROFILE_IMAGE_SIZE, GRADUATE_PROFILE_IMAGE_SIZE, {
        fit: "cover",
        position: "centre",
      })
      .webp({ quality: 82, effort: 4 })
      .toBuffer();
    return {
      buffer,
      contentType: "image/webp" as const,
      sha256: createHash("sha256").update(buffer).digest("hex"),
      width: GRADUATE_PROFILE_IMAGE_SIZE,
      height: GRADUATE_PROFILE_IMAGE_SIZE,
    };
  } catch {
    throw new Error("사진 파일을 안전하게 변환하지 못했습니다.");
  }
}

export function getGraduateFileSha256(source: Buffer) {
  return createHash("sha256").update(source).digest("hex");
}
