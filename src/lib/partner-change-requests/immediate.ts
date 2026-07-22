import { PartnerChangeRequestError } from "../partner-change-request-errors.ts";
import { buildAtomicAuditRpcContext } from "../audit-rpc-context.ts";
import { buildAdminMutationAuditProperties } from "../admin-mutation-audit.ts";
import { normalizePartnerBenefitActionType } from "../partner-benefit-action.ts";
import { getSupabaseAdminClient } from "../supabase/server.ts";
import { getSupabaseRequestContext } from "./context.ts";
import {
  arraysEqual,
  collectPartnerMediaUrls,
  collectPartnerMediaUrlsFromInput,
} from "./normalizers.ts";
import type {
  PartnerImmediateUpdateInput,
  PartnerImmediateUpdateResult,
} from "./shared.ts";
import { wrapPartnerChangeRequestDbError } from "./shared.ts";

export async function updateSupabasePartnerImmediateFields(
  input: PartnerImmediateUpdateInput,
): Promise<PartnerImmediateUpdateResult> {
  if (!input.auditContext) {
    throw new PartnerChangeRequestError(
      "invalid_request",
      "감사 요청 문맥이 없어 제휴처 정보를 저장할 수 없습니다.",
    );
  }
  const context = await getSupabaseRequestContext(input.companyIds, input.partnerId);
  if (!context) {
    throw new PartnerChangeRequestError(
      "forbidden",
      "해당 제휴처의 즉시 반영 항목을 수정할 수 없습니다.",
    );
  }

  const currentMediaUrls = collectPartnerMediaUrlsFromInput({
    thumbnail: input.thumbnail,
    images: input.images,
  });
  const benefitActionType = normalizePartnerBenefitActionType(
    input.benefitActionType,
    input.benefitActionLink || input.reservationLink ? "external_link" : "none",
  );
  const benefitActionLink =
    benefitActionType === "external_link"
      ? input.benefitActionLink ?? input.reservationLink
      : null;

  if (
    context.thumbnail === input.thumbnail &&
    arraysEqual(context.images, input.images) &&
    arraysEqual(context.tags, input.tags) &&
    context.benefitActionType === benefitActionType &&
    context.benefitActionLink === benefitActionLink &&
    JSON.stringify(context.benefitItems) === JSON.stringify(input.benefitItems ?? context.benefitItems) &&
    context.reservationLink === input.reservationLink &&
    context.inquiryLink === input.inquiryLink
  ) {
    throw new PartnerChangeRequestError(
      "no_changes",
      "현재 값과 다른 변경이 없어 저장할 수 없습니다.",
    );
  }

  const { data, error } = await getSupabaseAdminClient().rpc(
    "update_partner_immediate_fields_with_audit",
    {
      p_partner_id: input.partnerId,
      p_company_ids: input.companyIds,
      p_thumbnail: input.thumbnail,
      p_images: input.images,
      p_tags: input.tags,
      p_benefit_action_type: benefitActionType,
      p_benefit_action_link: benefitActionLink,
      p_benefit_items: (input.benefitItems ?? context.benefitItems).map((benefit, displayOrder) => ({
        id: benefit.id,
        title: benefit.title,
        maxApplyCount: benefit.maxApplyCount,
        displayOrder,
      })),
      p_reservation_link: input.reservationLink,
      p_inquiry_link: input.inquiryLink,
      ...buildAtomicAuditRpcContext(
        input.auditContext,
        buildAdminMutationAuditProperties({
          outcome: "success",
          properties: {
            partnerId: input.partnerId,
            companyId: context.companyId,
            tagCount: input.tags.length,
            imageCount: input.images.length,
            thumbnailChanged: context.thumbnail !== input.thumbnail,
            benefitActionTypeChanged: context.benefitActionType !== benefitActionType,
            benefitActionLinkChanged: context.benefitActionLink !== benefitActionLink,
            reservationLinkChanged: context.reservationLink !== input.reservationLink,
            inquiryLinkChanged: context.inquiryLink !== input.inquiryLink,
          },
        }),
      ),
    },
  );

  if (error) {
    throw wrapPartnerChangeRequestDbError(
      error,
      "제휴처 정보를 저장하지 못했습니다.",
    );
  }

  const mutationResult = Array.isArray(data) ? data[0] : data;
  if (!mutationResult) {
    throw new PartnerChangeRequestError(
      "invalid_request",
      "제휴처 정보를 저장하지 못했습니다.",
    );
  }

  return {
    partnerId: input.partnerId,
    companyId: String(mutationResult.company_id ?? context.companyId),
    previousMediaUrls: collectPartnerMediaUrls({
      thumbnail: mutationResult.previous_thumbnail ?? null,
      images: mutationResult.previous_images ?? [],
    }),
    currentMediaUrls,
  };
}
