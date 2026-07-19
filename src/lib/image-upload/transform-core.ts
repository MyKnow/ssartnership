import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import sharp from "sharp";
import { getHeifSpatialExtentError } from "@/lib/image-upload/heif";

export type ImageNormalizationPolicy = {
  width: number;
  height: number;
  quality: number;
  maxSourceBytes: number;
  maxInputPixels: number;
  maxOutputBytes: number;
  fit: "cover" | "contain";
};

const SUPPORTED_INPUT_FORMATS = new Set([
  "jpeg",
  "png",
  "webp",
  "avif",
  "heif",
  "gif",
  "bmp",
  "svg",
  "tiff",
]);

function assertSafeSvg(source: Buffer) {
  const svg = source.toString("utf8");
  if (!/^\s*(?:<\?xml[^>]*>\s*)?<svg\b/i.test(svg)) {
    throw new Error("SVG 이미지 형식을 확인해 주세요.");
  }
  if (/<\s*(?:script|foreignObject|iframe|object|embed)\b/i.test(svg)) {
    throw new Error("SVG에 허용되지 않는 요소가 포함되어 있습니다.");
  }
  if (/\son[a-z]+\s*=/i.test(svg)) {
    throw new Error("SVG에 허용되지 않는 이벤트가 포함되어 있습니다.");
  }
  if (/<!\s*(?:doctype|entity)\b/i.test(svg)) {
    throw new Error("SVG에 허용되지 않는 선언이 포함되어 있습니다.");
  }
  if (/\b(?:href|xlink:href)\s*=\s*(?:["']?\s*)?(?!#)[^\s>]+/i.test(svg)) {
    throw new Error("SVG는 외부 리소스를 참조할 수 없습니다.");
  }
  if (/\burl\(\s*(?:["']?\s*)?(?!#)[^)]+\)/i.test(svg)) {
    throw new Error("SVG는 외부 리소스를 참조할 수 없습니다.");
  }
}

function actualContentType(format: string) {
  switch (format) {
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "avif":
      return "image/avif";
    case "heif":
      return "image/heif";
    case "gif":
      return "image/gif";
    case "bmp":
      return "image/bmp";
    case "svg":
      return "image/svg+xml";
    case "tiff":
      return "image/tiff";
    default:
      return null;
  }
}

export type NormalizedImageBuffer = {
  buffer: Buffer;
  contentType: "image/webp";
  sha256: string;
  width: number;
  height: number;
  sourceContentType: string;
};

export type DecodedHeifImage = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

export type HeifDecoder = (source: ArrayBuffer) => Promise<DecodedHeifImage>;

const HEIF_CONTENT_TYPES = new Set([
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
]);
const requireFromModule = createRequire(import.meta.url);
let discourseHeifDecoderPromise: Promise<HeifDecoder> | null = null;

function isHeifContentType(contentType: string | null | undefined) {
  return HEIF_CONTENT_TYPES.has(contentType?.trim().toLowerCase() ?? "");
}

function sourceToArrayBuffer(source: Buffer) {
  const bytes = new Uint8Array(source);
  return bytes.buffer;
}

function makeNormalizedImageBuffer(
  buffer: Buffer,
  policy: ImageNormalizationPolicy,
  sourceContentType: string,
): NormalizedImageBuffer {
  if (!buffer.length || buffer.length > policy.maxOutputBytes) {
    throw new Error("변환된 이미지 용량이 허용 범위를 초과했습니다.");
  }
  return {
    buffer,
    contentType: "image/webp",
    sha256: createHash("sha256").update(buffer).digest("hex"),
    width: policy.width,
    height: policy.height,
    sourceContentType,
  };
}

async function getDiscourseHeifDecoder(): Promise<HeifDecoder> {
  const decoderModule = await import("@discourse/heic/decode.js") as unknown as {
    default: HeifDecoder;
    init: (module: WebAssembly.Module) => Promise<void> | void;
  };
  const wasmPath = requireFromModule.resolve("@discourse/heic/codec/dec/heic_dec.wasm");
  const wasmBinary = await readFile(wasmPath);
  await decoderModule.init(await WebAssembly.compile(wasmBinary));
  return decoderModule.default;
}

async function decodeHeifWithDiscourse(source: ArrayBuffer) {
  discourseHeifDecoderPromise ??= getDiscourseHeifDecoder();
  return (await discourseHeifDecoderPromise)(source);
}

async function normalizeHeifWithDecoder({
  source,
  policy,
  decodeHeif = decodeHeifWithDiscourse,
}: {
  source: Buffer;
  policy: ImageNormalizationPolicy;
  decodeHeif?: HeifDecoder;
}) {
  const sourceBuffer = sourceToArrayBuffer(source);
  const extentError = getHeifSpatialExtentError(sourceBuffer, policy.maxInputPixels);
  if (extentError) throw new Error(extentError);
  const decoded = await decodeHeif(sourceBuffer);
  if (
    !Number.isSafeInteger(decoded.width)
    || !Number.isSafeInteger(decoded.height)
    || decoded.width <= 0
    || decoded.height <= 0
    || decoded.width * decoded.height > policy.maxInputPixels
    || decoded.data.byteLength !== decoded.width * decoded.height * 4
  ) {
    throw new Error("이미지 해상도를 확인할 수 없습니다.");
  }
  const buffer = await sharp(Buffer.from(decoded.data), {
    raw: { width: decoded.width, height: decoded.height, channels: 4 },
    failOn: "error",
  })
    .resize(policy.width, policy.height, {
      fit: policy.fit,
      position: "centre",
      withoutEnlargement: false,
    })
    .webp({ quality: policy.quality, effort: 4 })
    .toBuffer();
  return makeNormalizedImageBuffer(buffer, policy, "image/heif");
}

function isExpectedImageProcessingError(error: unknown) {
  return error instanceof Error && /이미지|SVG|지원하지|변환된/.test(error.message);
}

export async function normalizeImageBuffer({
  source,
  declaredContentType,
  policy,
  decodeHeif,
}: {
  source: Buffer;
  declaredContentType?: string | null;
  policy: ImageNormalizationPolicy;
  decodeHeif?: HeifDecoder;
}): Promise<NormalizedImageBuffer> {
  if (!source.length || source.length > policy.maxSourceBytes) {
    throw new Error("이미지 파일 용량을 확인해 주세요.");
  }
  if (declaredContentType?.toLowerCase() === "image/svg+xml") {
    assertSafeSvg(source);
  }

  try {
    const image = sharp(source, {
      animated: false,
      limitInputPixels: policy.maxInputPixels,
      failOn: "error",
    }).rotate();
    const metadata = await image.metadata();
    const format = metadata.format;
    if (!format || !SUPPORTED_INPUT_FORMATS.has(format) || !actualContentType(format)) {
      throw new Error("지원하지 않는 이미지 형식입니다.");
    }
    if (format === "svg") {
      assertSafeSvg(source);
    }
    if (!metadata.width || !metadata.height) {
      throw new Error("이미지 크기를 확인할 수 없습니다.");
    }
    if (metadata.width * metadata.height > policy.maxInputPixels) {
      throw new Error("이미지 해상도가 너무 큽니다.");
    }

    const buffer = await image
      .resize(policy.width, policy.height, {
        fit: policy.fit,
        position: "centre",
        withoutEnlargement: false,
      })
      .webp({ quality: policy.quality, effort: 4 })
      .toBuffer();
    return makeNormalizedImageBuffer(buffer, policy, actualContentType(format) ?? "image/*");
  } catch (error) {
    if (isHeifContentType(declaredContentType) && !isExpectedImageProcessingError(error)) {
      try {
        return await normalizeHeifWithDecoder({ source, policy, decodeHeif });
      } catch (fallbackError) {
        if (isExpectedImageProcessingError(fallbackError)) {
          throw fallbackError;
        }
        throw new Error("이미지 파일을 처리할 수 없습니다.");
      }
    }
    if (isExpectedImageProcessingError(error)) {
      throw error;
    }
    throw new Error("이미지 파일을 처리할 수 없습니다.");
  }
}

export async function validateNormalizedImageBuffer({
  source,
  policy,
  expectedSha256,
}: {
  source: Buffer;
  policy: Pick<ImageNormalizationPolicy, "width" | "height" | "maxOutputBytes" | "maxInputPixels">;
  expectedSha256: string;
}) {
  if (!source.length || source.length > policy.maxOutputBytes) {
    throw new Error("처리된 이미지 파일 용량을 확인해 주세요.");
  }
  const actualSha256 = createHash("sha256").update(source).digest("hex");
  if (actualSha256 !== expectedSha256) {
    throw new Error("처리된 이미지 무결성을 확인해 주세요.");
  }
  try {
    const metadata = await sharp(source, {
      animated: false,
      limitInputPixels: policy.maxInputPixels,
      failOn: "error",
    }).metadata();
    if (
      metadata.format !== "webp"
      || metadata.width !== policy.width
      || metadata.height !== policy.height
    ) {
      throw new Error("처리된 이미지 형식을 확인해 주세요.");
    }
  } catch (error) {
    if (error instanceof Error && /처리된 이미지/.test(error.message)) {
      throw error;
    }
    throw new Error("처리된 이미지 파일을 확인할 수 없습니다.");
  }
}
