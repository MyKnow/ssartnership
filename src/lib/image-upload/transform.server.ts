import type { ImageTransformPolicy } from "@/lib/image-upload/policy";
import {
  normalizeImageBuffer,
  validateNormalizedImageBuffer,
  type NormalizedImageBuffer,
} from "@/lib/image-upload/transform-core";

export type NormalizeImageUploadInput = {
  source: Buffer;
  declaredContentType?: string | null;
  policy: ImageTransformPolicy;
};

export type NormalizedImageUpload = NormalizedImageBuffer;

export async function normalizeImageUpload(input: NormalizeImageUploadInput) {
  return normalizeImageBuffer(input);
}
export async function validateNormalizedImageUpload(input: {
  source: Buffer;
  policy: ImageTransformPolicy;
  expectedSha256: string;
}) {
  return validateNormalizedImageBuffer(input);
}
