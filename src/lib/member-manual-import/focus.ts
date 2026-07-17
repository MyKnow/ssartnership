import type { ManualMemberImportErrorCode } from "./shared";

export type ManualMemberImportFocusField =
  | "generation"
  | "name"
  | "campus"
  | "mmId"
  | "email"
  | "photo";

/** Returns the editable field that owns a row-scoped validation error. */
export function getManualMemberImportErrorFocusField(
  code: ManualMemberImportErrorCode,
): ManualMemberImportFocusField | null {
  switch (code) {
    case "generation_invalid":
      return "generation";
    case "name_required":
      return "name";
    case "campus_required":
    case "campus_invalid":
      return "campus";
    case "contact_required":
    case "mm_invalid":
      return "mmId";
    case "email_invalid":
      return "email";
    case "photo_filename_invalid":
    case "photo_filename_duplicate":
    case "photo_missing":
    case "photo_duplicate":
    case "photo_type_invalid":
    case "photo_too_large":
      return "photo";
    default:
      return null;
  }
}
