import { getPartnerAudienceLabel } from "@/lib/partner-audience";
import type { Partner } from "@/lib/types";

export function buildPartnerDirectorySearchText(partner: Partner) {
  return [
    partner.name,
    partner.location,
    partner.reservationLink ?? "",
    partner.inquiryLink ?? "",
    partner.conditions.join(" "),
    partner.benefits.join(" "),
    partner.appliesTo.map((item) => getPartnerAudienceLabel(item)).join(" "),
    (partner.tags ?? []).join(" "),
  ]
    .join(" ")
    .toLowerCase();
}

export function toLeanPublicDirectoryPartner(partner: Partner): Partner {
  return {
    ...partner,
    conditions: [],
    benefits: [],
    benefitItems: [],
    images: [],
    directorySearchText: buildPartnerDirectorySearchText(partner),
  };
}
