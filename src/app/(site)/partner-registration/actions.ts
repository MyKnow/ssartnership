"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  getServerActionLogContext,
  scheduleProductEventLog,
  resolveCurrentActor,
} from "@/lib/activity-logs";
import {
  ADMIN_PARTNER_FILE_MAX_BYTES,
  type AdminPartnerFileCompany,
} from "@/lib/admin-partner-file-import";
import { parseAdminPartnerXlsxDraft } from "@/lib/admin-partner-file-import.server";
import {
  createPartnerRegistrationInputFromDraft,
  hasPartnerRegistrationFieldErrors,
  PARTNER_REGISTRATION_INITIAL_EXCEL_ACTION_STATE,
  PARTNER_REGISTRATION_INITIAL_ACTION_STATE,
  validatePartnerRegistrationInput,
  type PartnerRegistrationActionState,
  type PartnerRegistrationExcelActionState,
} from "@/lib/partner-registration";
import {
  insertPartnerRegistrationRequest,
  loadPartnerRegistrationCategories,
  resolvePartnerRegistrationBranchPayload,
  resolvePartnerRegistrationMediaPayload,
} from "@/lib/partner-registration-submit.server";
import { isE2eMockMutationEnabled } from "@/lib/e2e-mutation-mode";
import { PARTNER_REGISTRATION_RATE_LIMIT, isBlocked, recordAttempt } from "@/lib/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { readFormIdempotencyKey } from "@/lib/form-idempotency";

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
  const mockMutation = isE2eMockMutationEnabled();

  if (
    !mockMutation &&
    (await isBlocked(identifier, PARTNER_REGISTRATION_RATE_LIMIT))
  ) {
    return {
      status: "error",
      message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    };
  }

  const validation = validatePartnerRegistrationInput(formData);
  if (hasPartnerRegistrationFieldErrors(validation.fieldErrors)) {
    if (!mockMutation) {
      await recordAttempt(identifier, false, PARTNER_REGISTRATION_RATE_LIMIT);
    }
    return {
      status: "error",
      message: "입력값을 확인해 주세요.",
      fieldErrors: validation.fieldErrors,
    };
  }

  if (mockMutation) {
    return {
      status: "success",
      message: "신청이 접수되었습니다. 담당자가 확인 후 안내드리겠습니다.",
      requestId: "e2e-mock-partner-registration",
    };
  }

  const requestId = readFormIdempotencyKey(formData);
  if (!requestId) {
    return {
      status: "error",
      message: "제출 정보를 준비하지 못했습니다. 입력 내용은 유지되므로 잠시 후 다시 시도해 주세요.",
    };
  }

  let categories;
  try {
    categories = await loadPartnerRegistrationCategories();
  } catch {
    return {
      status: "error",
      message: "카테고리 정보를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    };
  }

  const values = validation.values;
  let insertedRequest;
  try {
    const media = await resolvePartnerRegistrationMediaPayload(formData, requestId);
    const branches = await resolvePartnerRegistrationBranchPayload(formData, values);
    insertedRequest = await insertPartnerRegistrationRequest({
      requestId,
      values,
      categories,
      context: { source: "public_web" },
      media,
      branches,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "신청을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.";
    console.error("[partner-registration] insert failed", message);
    return {
      status: "error",
      message,
      fieldErrors: message.includes("지점") ? { branchListText: message } : undefined,
    };
  }

  await recordAttempt(identifier, false, PARTNER_REGISTRATION_RATE_LIMIT);

  if (insertedRequest.created) {
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
      targetId: insertedRequest.requestId,
      properties: {
        source: "public_web",
        serviceMode: values.serviceMode,
        benefitActionType: values.benefitActionType,
        brandName: values.brandName,
        categoryLabel: insertedRequest.categoryLabel,
        categoryMatched: insertedRequest.categoryMatched,
      },
    });
  }

  revalidatePath("/admin/partner-registrations");

  return {
    status: "success",
    message: "신청이 접수되었습니다. 담당자가 확인 후 안내드리겠습니다.",
    requestId: insertedRequest.requestId,
  };
}

function getXlsxFile(formData: FormData) {
  const file = formData.get("xlsxFile");
  return file instanceof File && file.size > 0 ? file : null;
}

function validateXlsxFile(file: File | null) {
  if (!file) {
    return "XLSX 파일을 업로드해 주세요.";
  }
  if (file.size > ADMIN_PARTNER_FILE_MAX_BYTES) {
    return "XLSX 파일은 1MB 이하만 업로드할 수 있습니다.";
  }
  if (!/\.xlsx$/i.test(file.name)) {
    return "파일 접수는 .xlsx 파일만 업로드할 수 있습니다.";
  }
  return null;
}

async function loadPartnerCompaniesForTemplateParse() {
  const result = await getSupabaseAdminClient()
    .from("partner_companies")
    .select("id,name")
    .order("created_at", { ascending: true });
  if (result.error) {
    throw new Error(result.error.message);
  }
  return (result.data ?? []) as AdminPartnerFileCompany[];
}

export async function createPartnerRegistrationExcelRequestAction(
  _prevState: PartnerRegistrationExcelActionState = PARTNER_REGISTRATION_INITIAL_EXCEL_ACTION_STATE,
  formData: FormData,
): Promise<PartnerRegistrationExcelActionState> {
  void _prevState;
  const headerStore = await headers();
  const identifier = getClientIdentifier(headerStore);

  if (await isBlocked(identifier, PARTNER_REGISTRATION_RATE_LIMIT)) {
    return {
      status: "error",
      message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    };
  }

  const file = getXlsxFile(formData);
  const fileError = validateXlsxFile(file);
  if (!file || fileError) {
    await recordAttempt(identifier, false, PARTNER_REGISTRATION_RATE_LIMIT);
    return {
      status: "error",
      message: "업로드 파일을 확인해 주세요.",
      fileError: fileError ?? "XLSX 파일을 업로드해 주세요.",
    };
  }

  let categories;
  let companies;
  try {
    [categories, companies] = await Promise.all([
      loadPartnerRegistrationCategories(),
      loadPartnerCompaniesForTemplateParse(),
    ]);
  } catch {
    return {
      status: "error",
      message: "기준 정보를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    };
  }

  const parseResult = await parseAdminPartnerXlsxDraft({
    fileBuffer: Buffer.from(await file.arrayBuffer()),
    categories,
    companies,
  });
  if (!parseResult.ok) {
    await recordAttempt(identifier, false, PARTNER_REGISTRATION_RATE_LIMIT);
    return {
      status: "error",
      message: "엑셀 내용을 확인해 주세요.",
      fileError: parseResult.errors.join(" "),
    };
  }

  const validation = validatePartnerRegistrationInput(
    createPartnerRegistrationInputFromDraft(parseResult.draft),
  );
  if (hasPartnerRegistrationFieldErrors(validation.fieldErrors)) {
    await recordAttempt(identifier, false, PARTNER_REGISTRATION_RATE_LIMIT);
    return {
      status: "error",
      message: "엑셀 필수 항목을 확인해 주세요.",
      fileError: Object.values(validation.fieldErrors).join(" "),
    };
  }

  let insertedRequest;
  try {
    insertedRequest = await insertPartnerRegistrationRequest({
      values: validation.values,
      categories,
      context: { source: "public_excel" },
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "신청을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.";
    console.error("[partner-registration:xlsx] insert failed", message);
    return {
      status: "error",
      message,
    };
  }

  await recordAttempt(identifier, false, PARTNER_REGISTRATION_RATE_LIMIT);

  const [context, actor] = await Promise.all([
    getServerActionLogContext("/partner-registration"),
    resolveCurrentActor(),
  ]);
  scheduleProductEventLog({
    ...context,
    eventName: "partner_registration_xlsx_submit",
    actorType: actor.actorType,
    actorId: actor.actorId,
    targetType: "partner_registration_request",
    targetId: insertedRequest.requestId,
    properties: {
      source: "public_excel",
      serviceMode: validation.values.serviceMode,
      benefitActionType: validation.values.benefitActionType,
      brandName: validation.values.brandName,
      categoryLabel: insertedRequest.categoryLabel,
      categoryMatched: insertedRequest.categoryMatched,
    },
  });

  revalidatePath("/admin/partner-registrations");

  return {
    status: "success",
    message: "엑셀 신청이 접수되었습니다. 담당자가 확인 후 안내드리겠습니다.",
    requestId: insertedRequest.requestId,
  };
}
