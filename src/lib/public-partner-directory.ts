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
  // 카드에 쓰지 않는 상세 소개·지점 메모는 전체 행(로그인 홈)에서 와도 클라이언트로 보내지 않습니다.
  const {
    detailDescription: _detailDescription,
    branchScopeNote: _branchScopeNote,
    ...cardFields
  } = partner;
  void _detailDescription;
  void _branchScopeNote;
  return {
    ...cardFields,
    conditions: [],
    // 홈 카드 비교에 필요한 짧은 제목은 남기고 적용 횟수 원장은 제거합니다.
    benefits: partner.benefits,
    benefitItems: [],
    images: [],
    directorySearchText: buildPartnerDirectorySearchText(partner),
  };
}
