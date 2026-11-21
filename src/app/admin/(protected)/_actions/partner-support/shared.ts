import { normalizePartnerLoginId } from "@/lib/partner-utils";
import type { PartnerCompanyInput } from "../shared-types";

export function toPartnerAccountDisplayName(
  company: PartnerCompanyInput,
) {
  return company.contactName || company.name || "제휴 담당자";
}

export function toPartnerAccountLoginId(
  company: PartnerCompanyInput,
) {
  const email = company.contactEmail || "";
  return normalizePartnerLoginId(email);
}
