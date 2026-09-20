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
    // 홈 카드 비교에 필요한 짧은 제목은 남기고 적용 횟수 원장은 제거합니다.
    benefits: partner.benefits,
    benefitItems: [],
    images: [],
    directorySearchText: buildPartnerDirectorySearchText(partner),
  };
}
