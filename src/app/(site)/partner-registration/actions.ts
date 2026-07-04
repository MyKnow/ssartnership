"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  getServerActionLogContext,
  scheduleProductEventLog,
  resolveCurrentActor,
} from "@/lib/activity-logs";
import {
  hasPartnerRegistrationFieldErrors,
  PARTNER_REGISTRATION_INITIAL_ACTION_STATE,
  resolvePartnerRegistrationCategory,
  validatePartnerRegistrationInput,
  type PartnerRegistrationActionState,
} from "@/lib/partner-registration";
import { PARTNER_REGISTRATION_RATE_LIMIT, isBlocked, recordAttempt } from "@/lib/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

function getClientIdentifier(headerStore: Awaited<ReturnType<typeof headers>>) {
  const forwarded = headerStore.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return headerStore.get("x-real-ip") ?? "unknown";
}

export async function createPartnerRegistrationRequestAction(
  _prevState: PartnerRegistrationActionState = PARTNER_REGISTRATION_INITIAL_ACTION_STATE,
  formData: FormData,
): Promise<PartnerRegistrationActionState> {
  void _prevState;
  const headerStore = await headers();
  const identifier = getClientIdentifier(headerStore);

  if (await isBlocked(identifier, PARTNER_REGISTRATION_RATE_LIMIT)) {
    return {
      status: "error",
      message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    };
  }

  const validation = validatePartnerRegistrationInput(formData);
  if (hasPartnerRegistrationFieldErrors(validation.fieldErrors)) {
    await recordAttempt(identifier, false, PARTNER_REGISTRATION_RATE_LIMIT);
    return {
      status: "error",
      message: "입력값을 확인해 주세요.",
      fieldErrors: validation.fieldErrors,
    };
  }

  const supabase = getSupabaseAdminClient();
  const categoriesResult = await supabase
    .from("categories")
    .select("id,key,label")
    .order("created_at", { ascending: true });

  if (categoriesResult.error) {
    return {
      status: "error",
      message: "카테고리 정보를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    };
  }

  const values = validation.values;
  const matchedCategory = resolvePartnerRegistrationCategory(
    values.categoryLabel,
    categoriesResult.data ?? [],
  );

  const insertResult = await supabase
    .from("partner_registration_requests")
    .insert({
      service_mode: values.serviceMode,
      benefit_action_type: values.benefitActionType,
      brand_name: values.brandName,
      category_id: matchedCategory?.id ?? null,
      category_label: matchedCategory?.label ?? values.categoryLabel,
      period_start: values.periodStart || null,
      period_end: values.periodEnd || null,
      inquiry_link: values.safeInquiryLink,
      brand_phone: values.safeBrandPhone,
      detail_description: values.detailDescription || null,
      company_name: values.companyName,
      contact_name: values.contactName,
      contact_email: values.contactEmail,
      contact_phone: values.contactPhone || null,
      company_description: values.companyDescription || null,
      benefits: values.parsedBenefits,
      conditions: values.parsedConditions,
      tags: values.parsedTags,
      location: values.location,
      map_url: values.safeMapUrl,
      site_link: values.safeSiteLink,
      benefit_action_link: values.safeBenefitActionLink,
      memo: values.memo || null,
    })
    .select("id")
    .single();

  if (insertResult.error) {
    console.error("[partner-registration] insert failed", insertResult.error.message);
    return {
      status: "error",
      message: "신청을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    };
  }

  await recordAttempt(identifier, false, PARTNER_REGISTRATION_RATE_LIMIT);

  const [context, actor] = await Promise.all([
    getServerActionLogContext("/partner-registration"),
    resolveCurrentActor(),
  ]);
  scheduleProductEventLog({
    ...context,
    eventName: "partner_registration_submit",
    actorType: actor.actorType,
    actorId: actor.actorId,
    targetType: "partner_registration_request",
    targetId: insertResult.data.id,
    properties: {
      serviceMode: values.serviceMode,
      benefitActionType: values.benefitActionType,
      brandName: values.brandName,
      categoryLabel: matchedCategory?.label ?? values.categoryLabel,
      categoryMatched: Boolean(matchedCategory),
    },
  });

  revalidatePath("/admin/partner-registrations");

  return {
    status: "success",
    message: "신청이 접수되었습니다. 담당자가 확인 후 안내드리겠습니다.",
    requestId: insertResult.data.id,
  };
}
