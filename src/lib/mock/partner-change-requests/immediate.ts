import { PartnerChangeRequestError } from "../../partner-change-request-errors.ts";
import type { PartnerImmediateUpdateInput } from "../../partner-change-requests/shared.ts";
import { arraysEqual, collectServiceMediaUrls, normalizeHttpUrlList } from "./normalizers.ts";
import { findService } from "./service-store.ts";

export async function updateMockPartnerImmediateFields(
  input: PartnerImmediateUpdateInput,
) {
  const service = findService(input.partnerId);
  if (!service || !input.companyIds.includes(service.companyId)) {
    throw new PartnerChangeRequestError(
      "forbidden",
      "해당 브랜드의 즉시 반영 항목을 수정할 수 없습니다.",
    );
  }

  const previousMediaUrls = collectServiceMediaUrls(service);
  const currentMediaUrls = normalizeHttpUrlList([
    input.thumbnail ?? null,
    ...(input.images ?? []),
  ]);

  if (
    service.thumbnail === input.thumbnail &&
    arraysEqual(service.images, input.images) &&
    arraysEqual(service.tags, input.tags) &&
    service.reservationLink === input.reservationLink &&
    service.inquiryLink === input.inquiryLink
  ) {
    throw new PartnerChangeRequestError(
      "no_changes",
      "현재 값과 다른 변경이 없어 저장할 수 없습니다.",
    );
  }

  service.thumbnail = input.thumbnail;
  service.images = [...input.images];
  service.tags = [...input.tags];
  service.reservationLink = input.reservationLink;
  service.inquiryLink = input.inquiryLink;

  return {
    partnerId: service.partnerId,
    companyId: service.companyId,
    previousMediaUrls,
    currentMediaUrls,
  };
}
