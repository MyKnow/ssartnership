import { createHash } from "node:crypto";
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFInvalidObject,
  PDFName,
  PDFRawStream,
  PDFStream,
  decodePDFRawStream,
  type PDFObject,
} from "pdf-lib";
import sharp, { type Metadata } from "sharp";
import {
  GRADUATE_PROFILE_IMAGE_SIZE,
  MAX_GRADUATE_CERTIFICATE_BYTES,
  MAX_GRADUATE_PROFILE_IMAGE_BYTES,
  MAX_GRADUATE_PROFILE_IMAGE_PIXELS,
  validateGraduatePhotoUpload,
} from "@/lib/graduate-verification";
import {
  resolveImageTransformPolicy,
} from "@/lib/image-upload/policy";
import { normalizeImageUpload } from "@/lib/image-upload/transform.server";

const PDF_MAGIC = Buffer.from("%PDF-");
const PDF_SECURITY_MARKERS = {
  encrypted: /\/Encrypt\b/i,
  javaScript: /\/(?:JavaScript|JS|Launch)\b/i,
  attachments: /\/(?:EmbeddedFiles?|Filespec)\b/i,
} as const;
const PDF_ACTIVE_CONTENT_NAMES = new Set(["javascript", "js", "launch"]);
const PDF_ATTACHMENT_NAMES = new Set(["embeddedfile", "embeddedfiles", "filespec"]);
const PDF_STRUCTURE_MAX_DEPTH = 64;

const PROFILE_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MIN_MATTERMOST_PROFILE_IMAGE_DIMENSION = 32;

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

function getPdfSourceText(source: Buffer | Uint8Array) {
  return Buffer.from(source.buffer, source.byteOffset, source.byteLength).toString("latin1");
}

/**
 * PDF 이름 객체의 `#xx` 이스케이프(`/J#61vaScript`)를 풀어 원문 정규식 우회를 막는다.
 */
export function decodePdfNameEscapes(text: string) {
  return text.replace(/#([0-9A-Fa-f]{2})/g, (_match, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  );
}

type PdfSecurityMarkers = {
  isEncrypted: boolean;
  hasJavaScript: boolean;
  hasAttachments: boolean;
};

const PDF_STREAM_BODY_PATTERN = /\bstream(?:\r\n|\r|\n)[\s\S]*?\bendstream\b/g;

/**
 * 파일 원문 검사에서는 이미지·폰트 같은 stream 본문의 이진 데이터를 제외한다.
 * 사전(dictionary)은 stream 밖이나 ObjStm 안에만 있으므로, ObjStm은 디코딩 후 따로 검사한다.
 */
export function stripPdfStreamBodies(text: string) {
  return text.replace(PDF_STREAM_BODY_PATTERN, "stream endstream");
}

function scanPdfTextForSecurityMarkers(text: string): PdfSecurityMarkers {
  const normalized = decodePdfNameEscapes(text);
  return {
    isEncrypted: PDF_SECURITY_MARKERS.encrypted.test(normalized),
    hasJavaScript: PDF_SECURITY_MARKERS.javaScript.test(normalized),
    hasAttachments: PDF_SECURITY_MARKERS.attachments.test(normalized),
  };
}

function mergePdfSecurityMarkers(
  left: PdfSecurityMarkers,
  right: PdfSecurityMarkers,
): PdfSecurityMarkers {
  return {
    isEncrypted: left.isEncrypted || right.isEncrypted,
    hasJavaScript: left.hasJavaScript || right.hasJavaScript,
    hasAttachments: left.hasAttachments || right.hasAttachments,
  };
}

/**
 * pdf-lib는 대문자 16진 이스케이프만 풀고 `#6a` 같은 소문자 이스케이프는 그대로 두므로,
 * 이름 비교 전에 한 번 더 정규화한다.
 */
function getPdfNameText(name: PDFName) {
  return decodePdfNameEscapes(name.decodeText());
}

function collectPdfObjectNames(
  object: PDFObject | undefined,
  names: Set<string>,
  depth: number,
): boolean {
  if (!object) {
    return true;
  }
  if (depth > PDF_STRUCTURE_MAX_DEPTH) {
    return false;
  }
  if (object instanceof PDFName) {
    names.add(getPdfNameText(object).toLowerCase());
    return true;
  }
  if (object instanceof PDFStream) {
    return collectPdfObjectNames(object.dict, names, depth + 1);
  }
  if (object instanceof PDFDict) {
    for (const [key, value] of object.entries()) {
      names.add(getPdfNameText(key).toLowerCase());
      if (!collectPdfObjectNames(value, names, depth + 1)) {
        return false;
      }
    }
    return true;
  }
  if (object instanceof PDFArray) {
    for (const item of object.asArray()) {
      if (!collectPdfObjectNames(item, names, depth + 1)) {
        return false;
      }
    }
  }
  return true;
}

function isPdfObjectStream(stream: PDFRawStream) {
  return stream.dict.entries().some(
    ([key, value]) =>
      getPdfNameText(key) === "Type"
      && value instanceof PDFName
      && getPdfNameText(value) === "ObjStm",
  );
}

/**
 * pdf-lib가 해석한 객체 그래프에서 위험 기능을 찾는다.
 * 압축 객체 스트림(ObjStm) 안의 사전과 이스케이프된 이름도 디코딩된 형태로 검사하며,
 * 해석하지 못한 객체 스트림이 남아 있으면 안전하다고 판단하지 않는다.
 */
function inspectParsedPdfStructure(document: PDFDocument) {
  const names = new Set<string>();
  let markers: PdfSecurityMarkers = {
    isEncrypted: document.isEncrypted,
    hasJavaScript: false,
    hasAttachments: false,
  };
  let isStructureTrusted = true;

  for (const [, object] of document.context.enumerateIndirectObjects()) {
    if (!collectPdfObjectNames(object, names, 0)) {
      isStructureTrusted = false;
    }
    if (object instanceof PDFInvalidObject) {
      const invalidBytes = new Uint8Array(object.sizeInBytes());
      object.copyBytesInto(invalidBytes, 0);
      markers = mergePdfSecurityMarkers(
        markers,
        scanPdfTextForSecurityMarkers(getPdfSourceText(invalidBytes)),
      );
    }
    if (object instanceof PDFRawStream && isPdfObjectStream(object)) {
      try {
        const decoded = decodePDFRawStream(object).decode();
        markers = mergePdfSecurityMarkers(
          markers,
          scanPdfTextForSecurityMarkers(getPdfSourceText(decoded)),
        );
      } catch {
        isStructureTrusted = false;
      }
    }
  }

  const hasName = (candidates: Set<string>) =>
    [...candidates].some((candidate) => names.has(candidate));
  markers = mergePdfSecurityMarkers(markers, {
    isEncrypted: names.has("encrypt"),
    hasJavaScript: hasName(PDF_ACTIVE_CONTENT_NAMES),
    hasAttachments: hasName(PDF_ATTACHMENT_NAMES),
  });

  return { markers, isStructureTrusted };
}

export async function inspectGraduateCertificatePdf(
  source: Buffer,
): Promise<GraduateCertificateInspection> {
  const hasMagic = hasPdfMagicBytes(source);
  const rawMarkers = scanPdfTextForSecurityMarkers(
    stripPdfStreamBodies(getPdfSourceText(source)),
  );

  if (!hasMagic || source.length === 0 || source.length > MAX_GRADUATE_CERTIFICATE_BYTES) {
    return {
      hasPdfMagicBytes: hasMagic,
      pageCount: 0,
      ...rawMarkers,
      isParseable: false,
    };
  }

  try {
    const document = await PDFDocument.load(source, {
      ignoreEncryption: false,
      updateMetadata: false,
    });
    const pageCount = document.getPageCount();
    const structure = inspectParsedPdfStructure(document);
    return {
      hasPdfMagicBytes: true,
      pageCount,
      ...mergePdfSecurityMarkers(rawMarkers, structure.markers),
      isParseable: structure.isStructureTrusted,
    };
  } catch {
    return {
      hasPdfMagicBytes: true,
      pageCount: 0,
      ...rawMarkers,
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

  let metadata: Metadata;
  try {
    metadata = await sharp(input.source, {
      animated: true,
      failOn: "error",
      limitInputPixels: MAX_GRADUATE_PROFILE_IMAGE_PIXELS,
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
      limitInputPixels: MAX_GRADUATE_PROFILE_IMAGE_PIXELS,
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

/**
 * Mattermost snapshots are trusted only as an input source. Their bytes are
 * decoded and re-encoded into the same private WebP contract used elsewhere.
 */
export async function normalizeMattermostProfileImage(input: {
  contentType: string;
  source: Buffer;
}) {
  if (input.source.length === 0 || input.source.length > MAX_GRADUATE_PROFILE_IMAGE_BYTES) {
    throw new Error("Mattermost 프로필 사진 크기를 확인해 주세요.");
  }

  let metadata: Metadata | null = null;
  try {
    metadata = await sharp(input.source, {
      animated: false,
      failOn: "error",
      limitInputPixels: MAX_GRADUATE_PROFILE_IMAGE_PIXELS,
    }).metadata();
  } catch {
    // HEIC/HEIF can require the common @discourse/heic fallback. The common
    // normalizer below is the authoritative byte/MIME/pixel validator.
    metadata = null;
  }

  if (
    metadata
    && (
      (metadata.width ?? 0) < MIN_MATTERMOST_PROFILE_IMAGE_DIMENSION
      || (metadata.height ?? 0) < MIN_MATTERMOST_PROFILE_IMAGE_DIMENSION
    )
  ) {
    throw new Error("Mattermost 프로필 사진 해상도가 너무 낮습니다.");
  }

  try {
    return await normalizeImageUpload({
      source: input.source,
      declaredContentType: input.contentType,
      policy: resolveImageTransformPolicy("profile", "profile"),
    });
  } catch {
    throw new Error("Mattermost 프로필 사진을 안전하게 변환하지 못했습니다.");
  }
}

export function getGraduateFileSha256(source: Buffer) {
  return createHash("sha256").update(source).digest("hex");
}
