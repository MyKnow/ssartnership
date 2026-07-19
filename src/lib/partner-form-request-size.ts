const FORM_DATA_PART_OVERHEAD_BYTES = 512;
const DIRECT_IMAGE_FIELD_NAMES = new Set(["thumbnailFile", "galleryFiles"]);

/**
 * Keep the Server Action limit below Vercel's Function request limit while
 * leaving room for multipart boundaries and field metadata.
 */
export const PARTNER_FORM_SERVER_ACTION_BODY_LIMIT_BYTES = 4 * 1024 * 1024;
export const PARTNER_FORM_MULTIPART_SAFETY_BUFFER_BYTES = 128 * 1024;
export const PARTNER_FORM_SAFE_REQUEST_BODY_BYTES =
  PARTNER_FORM_SERVER_ACTION_BODY_LIMIT_BYTES -
  PARTNER_FORM_MULTIPART_SAFETY_BUFFER_BYTES;

const encoder = new TextEncoder();

function getTextByteLength(value: string) {
  return encoder.encode(value).byteLength;
}

function isFileValue(value: FormDataEntryValue): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

/**
 * Estimates the raw multipart request size before a Server Action is called.
 * The safety buffer intentionally overestimates boundary/header overhead so a
 * request rejected here never reaches the platform body-size limit.
 */
export function estimatePartnerFormRequestBytes(formData: FormData) {
  let bytes = PARTNER_FORM_MULTIPART_SAFETY_BUFFER_BYTES;

  for (const [name, value] of formData.entries()) {
    // Browser images are uploaded to private staging first and represented by
    // an uploadId manifest in the Server Action. Keep this guard focused on
    // the remaining text/XLSX payload instead of reintroducing an image-size
    // rejection path that loses form progress.
    if (isFileValue(value) && DIRECT_IMAGE_FIELD_NAMES.has(name)) {
      continue;
    }
    bytes += getTextByteLength(name) + FORM_DATA_PART_OVERHEAD_BYTES;
    if (isFileValue(value)) {
      bytes +=
        value.size +
        getTextByteLength(value.name) +
        getTextByteLength(value.type);
      continue;
    }
    bytes += getTextByteLength(value);
  }

  return bytes;
}

export function isPartnerFormRequestWithinSafeLimit(formData: FormData) {
  return estimatePartnerFormRequestBytes(formData) < PARTNER_FORM_SAFE_REQUEST_BODY_BYTES;
}
