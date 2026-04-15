import { PartnerChangeRequestError } from "../partner-change-request-errors.ts";
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
  const context = await getSupabaseRequestContext(input.companyIds, input.partnerId);
  if (!context) {
    throw new PartnerChangeRequestError(
      "forbidden",
      "해당 브랜드의 즉시 반영 항목을 수정할 수 없습니다.",
    );
  }

  const previousMediaUrls = collectPartnerMediaUrls({
    thumbnail: context.thumbnail,
    images: context.images,
  });
  const currentMediaUrls = collectPartnerMediaUrlsFromInput({
    thumbnail: input.thumbnail,
    images: input.images,
  });

  if (
    context.thumbnail === input.thumbnail &&
    arraysEqual(context.images, input.images) &&
    arraysEqual(context.tags, input.tags) &&
    context.reservationLink === input.reservationLink &&
    context.inquiryLink === input.inquiryLink
  ) {
    throw new PartnerChangeRequestError(
      "no_changes",
      "현재 값과 다른 변경이 없어 저장할 수 없습니다.",
    );
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("partners")
    .update({
      thumbnail: input.thumbnail,
      images: input.images,
      tags: input.tags,
      reservation_link: input.reservationLink,
      inquiry_link: input.inquiryLink,
    })
    .eq("id", input.partnerId);

  if (error) {
    throw wrapPartnerChangeRequestDbError(
      error,
      "변경 요청 정보를 불러오지 못했습니다.",
    );
  }

  return {
    partnerId: input.partnerId,
    companyId: context.companyId,
    previousMediaUrls,
    currentMediaUrls,
  };
}
