import type { CampusSlug } from "@/lib/campuses";
import type { PartnerBenefitActionType } from "@/lib/partner-benefit-action";
import type { PartnerBenefitVisibility } from "@/lib/partner-benefit-visibility";
import {
  ONLINE_PARTNER_LOCATION,
  type PartnerServiceMode,
} from "@/lib/partner-service-mode";
import type { PartnerVisibility } from "@/lib/types";

export const ADMIN_PARTNER_FILE_TEMPLATE_VERSION = "1";
export const ADMIN_PARTNER_FILE_MAX_BYTES = 1024 * 1024;

export type AdminPartnerFileBenefitActionType = PartnerBenefitActionType;

export type AdminPartnerFileTemplateOptions = {
  serviceMode: PartnerServiceMode;
  benefitActionType: AdminPartnerFileBenefitActionType;
};

export type AdminPartnerFileCategory = {
  id: string;
  key?: string;
  label: string;
};

export type AdminPartnerFileCompany = {
  id: string;
  name: string;
};

export type AdminPartnerFileDraft = {
  categoryId: string;
  partner: {
    name: string;
    visibility: PartnerVisibility;
    benefitVisibility: PartnerBenefitVisibility;
    location: string;
    detailDescription: string;
    campusSlugs: CampusSlug[];
    mapUrl: string;
    benefitActionType: PartnerBenefitActionType;
    benefitActionLink: string;
    reservationLink: string;
    inquiryLink: string;
    period: {
      start: string;
      end: string;
    };
    conditions: string[];
    benefits: string[];
    appliesTo: string[];
    thumbnail: string | null;
    images: string[];
    tags: string[];
    company: {
      id?: string;
      name?: string;
      contactName?: string;
      contactEmail?: string;
      contactPhone?: string;
      description?: string;
    } | null;
  };
};

export type AdminPartnerFileParseResult =
  | {
      ok: true;
      draft: AdminPartnerFileDraft;
    }
  | {
      ok: false;
      errors: string[];
    };

export const ADMIN_PARTNER_FILE_SERVICE_MODE_LABELS: Record<
  PartnerServiceMode,
  string
> = {
  offline: "오프라인 서비스",
  online: "온라인 서비스",
};

export const ADMIN_PARTNER_FILE_BENEFIT_ACTION_LABELS: Record<
  AdminPartnerFileBenefitActionType,
  string
> = {
  external_link: "외부 링크로 이용",
  certification: "싸트너십 인증으로 이용",
  onsite: "현장 제시로 이용",
  none: "별도 행동 없음",
};

const BASE_HEADERS = [
  "브랜드명",
  "카테고리",
  "시작일",
  "종료일",
  "문의 링크",
  "상세 설명",
  "협력사명",
  "담당자명",
  "담당자 이메일",
  "담당자 전화번호",
  "협력사 설명",
  "혜택",
  "이용 조건",
  "태그",
] as const;

const OFFLINE_HEADERS = ["위치", "지도 URL"] as const;
const ONLINE_HEADERS = ["사이트 링크"] as const;
const EXTERNAL_LINK_HEADERS = ["혜택 이용 링크"] as const;

export function getAdminPartnerFileInputHeaders(
  options: AdminPartnerFileTemplateOptions,
) {
  return [
    ...BASE_HEADERS,
    ...(options.serviceMode === "online" ? ONLINE_HEADERS : OFFLINE_HEADERS),
    ...(options.benefitActionType === "external_link"
      ? EXTERNAL_LINK_HEADERS
      : []),
  ];
}

export function isAdminPartnerFileTemplateOptions(
  value: AdminPartnerFileTemplateOptions,
) {
  return (
    (value.serviceMode === "offline" || value.serviceMode === "online") &&
    value.benefitActionType in ADMIN_PARTNER_FILE_BENEFIT_ACTION_LABELS
  );
}

export function createPartnerFileDraftFormData(draft: AdminPartnerFileDraft) {
  const formData = new FormData();
  const { partner } = draft;

  formData.set("name", partner.name);
  formData.set("categoryId", draft.categoryId);
  formData.set(
    "serviceMode",
    partner.location === ONLINE_PARTNER_LOCATION ? "online" : "offline",
  );
  formData.set("location", partner.location);
  formData.set("detailDescription", partner.detailDescription);
  for (const campusSlug of partner.campusSlugs) {
    formData.append("campusSlugs", campusSlug);
  }
  formData.set("mapUrl", partner.mapUrl);
  formData.set("visibility", partner.visibility);
  formData.set("benefitVisibility", partner.benefitVisibility);
  formData.set("benefitActionType", partner.benefitActionType);
  formData.set("benefitActionLink", partner.benefitActionLink);
  formData.set("reservationLink", partner.reservationLink);
  formData.set("inquiryLink", partner.inquiryLink);
  formData.set("periodStart", partner.period.start);
  formData.set("periodEnd", partner.period.end);
  formData.set("conditions", partner.conditions.join("\n"));
  formData.set("benefits", partner.benefits.join("\n"));
  for (const audience of partner.appliesTo) {
    formData.append("appliesTo", audience);
  }
  formData.set("tags", partner.tags.join("\n"));
  formData.set("companyId", partner.company?.id ?? "");
  formData.set("companyName", partner.company?.name ?? "");
  formData.set("companyContactName", partner.company?.contactName ?? "");
  formData.set("companyContactEmail", partner.company?.contactEmail ?? "");
  formData.set("companyContactPhone", partner.company?.contactPhone ?? "");
  formData.set("companyDescription", partner.company?.description ?? "");

  return formData;
}
