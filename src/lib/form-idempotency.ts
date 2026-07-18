import { isUuid } from "@/lib/uuid";

/**
 * Reads a single client-generated form retry key. The UUID is not an
 * authorization credential; the corresponding action still verifies the
 * current actor and every attached upload session.
 */
export function readFormIdempotencyKey(
  formData: FormData,
  fieldName = "idempotencyKey",
) {
  const values = formData.getAll(fieldName);
  if (values.length !== 1 || typeof values[0] !== "string") {
    return null;
  }
  const value = values[0].trim();
  return isUuid(value) ? value.toLowerCase() : null;
}
