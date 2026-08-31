import { createHash } from "node:crypto";

const HASHED_IDENTIFIER_PATTERN = /^[0-9a-f]{64}$/i;

function normalizeIdentifier(value: string) {
  return value.trim();
}

export function hashImageUploadQuotaIdentifier(scope: string, value: string) {
  const normalizedScope = scope.trim().toLowerCase();
  const normalizedValue = normalizeIdentifier(value);
  if (!normalizedScope || !normalizedValue) {
    throw new Error("이미지 업로드 식별자를 확인해 주세요.");
  }
  return createHash("sha256")
    .update(`image-upload-quota:${normalizedScope}:${normalizedValue}`)
    .digest("hex");
}

export function buildImageUploadQuotaIdentifiers(input: {
  ipAddress?: string | null;
  accountIdentifier?: string | null;
}) {
  const identifiers = [
    input.accountIdentifier
      ? hashImageUploadQuotaIdentifier("account", input.accountIdentifier)
      : null,
    input.ipAddress
      ? hashImageUploadQuotaIdentifier("ip", input.ipAddress)
      : null,
  ];

  return [...new Set(identifiers.filter((value): value is string => Boolean(value)))];
}

export function isHashedImageUploadQuotaIdentifier(value: string) {
  return HASHED_IDENTIFIER_PATTERN.test(value);
}
