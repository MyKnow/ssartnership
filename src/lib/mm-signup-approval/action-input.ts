import { isUuid } from "@/lib/uuid";

export function parseMemberSignupRequestId(value: FormDataEntryValue | null) {
  const requestId = String(value ?? "").trim();
  return isUuid(requestId) ? requestId : null;
}
