import { deletePartnerMediaUrls } from "../../partner-media-storage.ts";
import { PartnerChangeRequestError } from "../../partner-change-request-errors.ts";
import { getSupabaseAdminClient } from "../../supabase/server.ts";
import { fetchRequestSummary, toSummary } from "../summary.ts";
import {
  collectPartnerChangeRequestRequestedMediaUrls,
  collectPartnerMediaUrls,
} from "../normalizers.ts";
import {
  normalizeCompanyIds,
  REQUEST_SELECT,
  type PartnerChangeRequestCancelInput,
  type PartnerChangeRequestRow,
  wrapPartnerChangeRequestDbError,
} from "../shared.ts";

export async function cancelSupabaseRequest(input: PartnerChangeRequestCancelInput) {
  const supabase = getSupabaseAdminClient();
  const { data: request, error: requestError } = await supabase
    .from("partner_change_requests")
    .select(REQUEST_SELECT)
    .eq("id", input.requestId)
    .maybeSingle();

  if (requestError) {
    throw wrapPartnerChangeRequestDbError(
      requestError,
      "변경 요청을 불러오지 못했습니다.",
    );
  }
  if (!request) {
    throw new PartnerChangeRequestError("not_found", "요청을 찾을 수 없습니다.");
  }

  const summary = toSummary(request as PartnerChangeRequestRow);
  if (summary.status !== "pending") {
    throw new PartnerChangeRequestError(
      "already_resolved",
      "이미 처리된 요청입니다.",
    );
  }

  const { data: currentPartner, error: currentPartnerError } = await supabase
    .from("partners")
    .select("thumbnail,images")
    .eq("id", summary.partnerId)
    .maybeSingle();

  if (currentPartnerError) {
    throw wrapPartnerChangeRequestDbError(
      currentPartnerError,
      "현재 브랜드 정보를 불러오지 못했습니다.",
    );
  }

  if (
    summary.requestedByAccountId !== input.accountId ||
    !normalizeCompanyIds(input.companyIds).includes(summary.companyId)
  ) {
    throw new PartnerChangeRequestError(
      "forbidden",
      "해당 요청을 취소할 수 없습니다.",
    );
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("partner_change_requests")
    .update({
      status: "cancelled",
      cancelled_by_account_id: input.accountId,
      cancelled_at: now,
      updated_at: now,
    })
    .eq("id", input.requestId);

  if (error) {
    throw wrapPartnerChangeRequestDbError(
      error,
      "변경 요청 상태를 저장하지 못했습니다.",
    );
  }

  const cancelled = await fetchRequestSummary(supabase, input.requestId);
  if (!cancelled) {
    throw new PartnerChangeRequestError(
      "not_found",
      "취소된 요청을 확인하지 못했습니다.",
    );
  }

  const currentMediaUrls = collectPartnerMediaUrls(currentPartner as {
    thumbnail?: string | null;
    images?: string[] | null;
  } | null);
  const requestedMediaUrls =
    collectPartnerChangeRequestRequestedMediaUrls(cancelled);
  await deletePartnerMediaUrls(
    requestedMediaUrls.filter((url) => !currentMediaUrls.includes(url)),
  ).catch(() => undefined);

  return cancelled;
}
