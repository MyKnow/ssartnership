import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import {
  requireAdminPermission,
  requireMattermostSenderAdmin,
} from "@/lib/admin-access";
import { getServerActionLogContext } from "@/lib/activity-logs";
import type { AtomicAuditContext } from "@/lib/audit-rpc-context";
import { MattermostApiError, MattermostClient } from "@/lib/mattermost/client";
import { getActiveMattermostSenderKey, getMattermostSenderKeyring } from "@/lib/mattermost-senders/config";
import {
  encryptMattermostSenderCredentials,
} from "@/lib/mattermost-senders/crypto";
import { maskMattermostSenderIdentifier } from "@/lib/mattermost-senders/masking";
import {
  recordMattermostSenderTestAttempt,
  getMattermostSenderTestBlockingState,
} from "@/lib/mattermost-senders/rate-limit";
import { mattermostSenderRepository } from "@/lib/mattermost-senders/repository";
import { resolveMattermostSenderTestRecipient } from "@/lib/mattermost-senders/routing";
import type { MattermostSenderSafeErrorCode } from "@/lib/mattermost-senders/types";
import { parseMattermostSenderCredentialInput } from "@/lib/mattermost-senders/validation";
import {
  clearSsafyCycleOverride,
  getConfiguredCurrentSsafyYear,
  getSsafyCycleSettings,
  setSsafyCycleEarlyStart,
  upsertSsafyCycleSettings,
} from "@/lib/ssafy-cycle-settings";
import {
  deleteCohortCardTheme,
  upsertCohortCardTheme,
} from "@/lib/cohort-card-themes";
import {
  logAdminAction,
  redirectAdminActionError,
  revalidateCyclePaths,
} from "./shared-helpers";
import {
  parseCohortCardThemeDeletePayloadOrRedirect,
  parseCohortCardThemePayloadOrRedirect,
  parseSsafyCycleSettingsPayloadOrRedirect,
} from "./shared-parser-redirects";

const MATTERMOST_SENDER_PATH = "/admin/cycle";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

function createMattermostSenderAuditContext(
  adminId: string,
  context: Awaited<ReturnType<typeof getServerActionLogContext>>,
): AtomicAuditContext {
  return {
    principal: {
      actorType: "admin",
      actorId: adminId,
    },
    request: {
      requestId: context.requestId ?? randomUUID(),
      path: context.path ?? MATTERMOST_SENDER_PATH,
      userAgent: context.userAgent ?? null,
      ipAddress: context.ipAddress ?? null,
    },
  };
}

function getMattermostSenderErrorCode(error: unknown): MattermostSenderSafeErrorCode {
  if (error instanceof MattermostApiError) {
    return error.code;
  }
  return "unavailable";
}

function redirectMattermostSenderError(
  code: string,
  action:
    | "mattermost_sender_candidate_save"
    | "mattermost_sender_test"
    | "mattermost_sender_disable",
  properties?: Record<string, unknown>,
): never {
  redirectAdminActionError(MATTERMOST_SENDER_PATH, code, {
    action,
    targetType: "mattermost_sender",
    properties,
  });
}

export async function updateSsafyCycleSettingsAction(formData: FormData) {
  await requireAdminPermission("cycles", "update", { path: "/admin/cycle" });
  const payload = parseSsafyCycleSettingsPayloadOrRedirect(
    formData,
    "/admin/cycle",
  );
  await upsertSsafyCycleSettings(payload);
  await logAdminAction("cycle_settings_update", {
    targetType: "cycle_settings",
    targetId: "singleton",
    properties: payload,
  });
  revalidateCyclePaths();
  redirect("/admin/cycle?status=updated");
}

export async function earlyStartSsafyCycleAction() {
  await requireAdminPermission("cycles", "update", { path: "/admin/cycle" });
  const settings = await getSsafyCycleSettings();
  const currentYear = getConfiguredCurrentSsafyYear(settings);
  const targetYear = currentYear + 1;
  await setSsafyCycleEarlyStart(targetYear);
  await logAdminAction("cycle_settings_early_start", {
    targetType: "cycle_settings",
    targetId: "singleton",
    properties: {
      currentYear,
      targetYear,
      anchorYear: settings.anchorYear,
      anchorCalendarYear: settings.anchorCalendarYear,
      anchorMonth: settings.anchorMonth,
    },
  });
  revalidateCyclePaths();
  redirect("/admin/cycle?status=early-started");
}

export async function restoreSsafyCycleSettingsAction() {
  await requireAdminPermission("cycles", "update", { path: "/admin/cycle" });
  const settings = await getSsafyCycleSettings();
  await clearSsafyCycleOverride();
  await logAdminAction("cycle_settings_restore", {
    targetType: "cycle_settings",
    targetId: "singleton",
    properties: {
      currentYear: getConfiguredCurrentSsafyYear(settings),
      anchorYear: settings.anchorYear,
      anchorCalendarYear: settings.anchorCalendarYear,
      anchorMonth: settings.anchorMonth,
    },
  });
  revalidateCyclePaths();
  redirect("/admin/cycle?status=restored");
}

export async function upsertCohortCardThemeAction(formData: FormData) {
  await requireAdminPermission("cycles", "update", { path: "/admin/cycle" });
  const payload = parseCohortCardThemePayloadOrRedirect(
    formData,
    "/admin/cycle",
  );
  await upsertCohortCardTheme(payload);
  await logAdminAction("cohort_card_theme_upsert", {
    targetType: "ssafy_cohort_card_theme",
    targetId: String(payload.cohortYear),
    properties: {
      cohortYear: payload.cohortYear,
      displayName: payload.displayName,
      backgroundFrom: payload.backgroundFrom,
      backgroundVia: payload.backgroundVia,
      backgroundTo: payload.backgroundTo,
      accentColor: payload.accentColor,
    },
  });
  revalidateCyclePaths();
  redirect("/admin/cycle?status=theme-saved#card-theme-manager");
}

export async function deleteCohortCardThemeAction(formData: FormData) {
  await requireAdminPermission("cycles", "delete", { path: "/admin/cycle" });
  const payload = parseCohortCardThemeDeletePayloadOrRedirect(
    formData,
    "/admin/cycle",
  );
  await deleteCohortCardTheme(payload.cohortYear);
  await logAdminAction("cohort_card_theme_delete", {
    targetType: "ssafy_cohort_card_theme",
    targetId: String(payload.cohortYear),
    properties: payload,
  });
  revalidateCyclePaths();
  redirect("/admin/cycle?status=theme-deleted#card-theme-manager");
}

export async function saveMattermostSenderCandidateAction(formData: FormData) {
  const session = await requireMattermostSenderAdmin("create", {
    path: MATTERMOST_SENDER_PATH,
  });
  const parsed = parseMattermostSenderCredentialInput({
    generation: getFormString(formData, "generation"),
    loginId: getFormString(formData, "loginId"),
    password: getFormString(formData, "password"),
  });
  if (!parsed.ok) {
    redirectMattermostSenderError(
      "mattermost_sender_invalid_request",
      "mattermost_sender_candidate_save",
      { fieldNames: Object.keys(parsed.fieldErrors) },
    );
  }

  let encryptedCredentials;
  try {
    encryptedCredentials = encryptMattermostSenderCredentials(
      { loginId: parsed.data.loginId, password: parsed.data.password },
      getActiveMattermostSenderKey(),
    );
  } catch {
    redirectMattermostSenderError(
      "mattermost_sender_configuration_failed",
      "mattermost_sender_candidate_save",
      { generation: parsed.data.generation },
    );
  }

  const logContext = await getServerActionLogContext(MATTERMOST_SENDER_PATH);
  try {
    await mattermostSenderRepository.saveCandidate({
      generation: parsed.data.generation,
      loginIdHint: maskMattermostSenderIdentifier(parsed.data.loginId),
      encryptedCredentials,
      audit: {
        context: createMattermostSenderAuditContext(session.adminId, logContext),
        properties: {
          generation: parsed.data.generation,
          keyVersion: encryptedCredentials.keyVersion,
          status: "pending",
        },
      },
    });
  } catch {
    redirectMattermostSenderError(
      "mattermost_sender_configuration_failed",
      "mattermost_sender_candidate_save",
      { generation: parsed.data.generation },
    );
  }

  revalidateCyclePaths();
  redirect("/admin/cycle?status=mattermost-sender-saved#mattermost-sender");
}

export async function testMattermostSenderCandidateAction(formData: FormData) {
  const session = await requireMattermostSenderAdmin("update", {
    path: MATTERMOST_SENDER_PATH,
  });
  const candidateId = getFormString(formData, "candidateId");
  if (!isUuid(candidateId)) {
    redirectMattermostSenderError(
      "mattermost_sender_invalid_request",
      "mattermost_sender_test",
    );
  }

  const logContext = await getServerActionLogContext(MATTERMOST_SENDER_PATH);
  const auditContext = createMattermostSenderAuditContext(session.adminId, logContext);
  const rateLimitInput = {
    adminId: session.adminId,
    candidateId,
    ipAddress: logContext.ipAddress,
  };
  const blocked = await getMattermostSenderTestBlockingState(rateLimitInput);
  if (blocked) {
    redirectMattermostSenderError(
      "mattermost_sender_test_rate_limited",
      "mattermost_sender_test",
      { candidateId, reasonCode: "rate_limited" },
    );
  }

  let candidate;
  try {
    candidate = await mattermostSenderRepository.getPendingCandidateForTest(
      candidateId,
      getMattermostSenderKeyring(),
    );
  } catch {
    redirectMattermostSenderError(
      "mattermost_sender_configuration_failed",
      "mattermost_sender_test",
      { candidateId },
    );
  }
  if (!candidate) {
    redirectMattermostSenderError(
      "mattermost_sender_candidate_missing",
      "mattermost_sender_test",
      { candidateId },
    );
  }

  let recipient;
  try {
    const testContext = await mattermostSenderRepository.getTestContext(
      candidate.generation,
      session.adminId,
    );
    recipient = resolveMattermostSenderTestRecipient({
      generation: candidate.generation,
      ...testContext,
    });
  } catch {
    recipient = null;
  }
  if (!recipient) {
    await recordMattermostSenderTestAttempt(rateLimitInput, false).catch(() => undefined);
    await mattermostSenderRepository.recordTestFailure({
      candidateId,
      errorCode: "test_target_unavailable",
      audit: {
        context: auditContext,
        properties: {
          generation: candidate.generation,
          reasonCode: "test_target_unavailable",
        },
      },
    }).catch(() => undefined);
    redirectMattermostSenderError(
      "mattermost_sender_test_target_unavailable",
      "mattermost_sender_test",
      { generation: candidate.generation, reasonCode: "test_target_unavailable" },
    );
  }

  try {
    const sender = await new MattermostClient().withAuthenticatedSender(
      candidate.credentials,
      async (mattermost) => {
        await mattermost.sendDirectMessage(
          recipient.userId,
          "SSAFY Partnership Mattermost Sender 연결 테스트입니다.",
        );
        return mattermost.user;
      },
    );
    await mattermostSenderRepository.activateCandidate({
      candidateId,
      senderMattermostUserId: sender.id,
      senderUsernameHint: maskMattermostSenderIdentifier(sender.username),
      testTargetKind: recipient.kind,
      audit: {
        context: auditContext,
        properties: {
          generation: candidate.generation,
          testTargetKind: recipient.kind,
          status: "active",
        },
      },
    });
    await recordMattermostSenderTestAttempt(rateLimitInput, true).catch(() => undefined);
  } catch (error) {
    const errorCode = getMattermostSenderErrorCode(error);
    await recordMattermostSenderTestAttempt(rateLimitInput, false).catch(() => undefined);
    await mattermostSenderRepository.recordTestFailure({
      candidateId,
      errorCode,
      audit: {
        context: auditContext,
        properties: {
          generation: candidate.generation,
          reasonCode: errorCode,
        },
      },
    }).catch(() => undefined);
    redirectMattermostSenderError(
      "mattermost_sender_test_failed",
      "mattermost_sender_test",
      { generation: candidate.generation, reasonCode: errorCode },
    );
  }

  revalidateCyclePaths();
  redirect("/admin/cycle?status=mattermost-sender-activated#mattermost-sender");
}

export async function disableMattermostSenderAction(formData: FormData) {
  const session = await requireMattermostSenderAdmin("delete", {
    path: MATTERMOST_SENDER_PATH,
  });
  const candidateId = getFormString(formData, "candidateId");
  if (!isUuid(candidateId)) {
    redirectMattermostSenderError(
      "mattermost_sender_invalid_request",
      "mattermost_sender_disable",
    );
  }

  let sender;
  try {
    sender = await mattermostSenderRepository.getMetadataById(candidateId);
  } catch {
    redirectMattermostSenderError(
      "mattermost_sender_disable_failed",
      "mattermost_sender_disable",
      { candidateId },
    );
  }
  if (!sender) {
    redirectMattermostSenderError(
      "mattermost_sender_candidate_missing",
      "mattermost_sender_disable",
      { candidateId },
    );
  }

  const expectedConfirmation = `${sender.generation}기 비활성화`;
  if (getFormString(formData, "confirmationText").trim() !== expectedConfirmation) {
    redirectMattermostSenderError(
      "mattermost_sender_disable_confirmation_invalid",
      "mattermost_sender_disable",
      { generation: sender.generation },
    );
  }

  const logContext = await getServerActionLogContext(MATTERMOST_SENDER_PATH);
  try {
    await mattermostSenderRepository.disableSender({
      candidateId,
      generationConfirmation: sender.generation,
      audit: {
        context: createMattermostSenderAuditContext(session.adminId, logContext),
        properties: {
          generation: sender.generation,
          previousStatus: sender.status,
          confirmation: "generation_typed",
        },
      },
    });
  } catch {
    redirectMattermostSenderError(
      "mattermost_sender_disable_failed",
      "mattermost_sender_disable",
      { generation: sender.generation },
    );
  }

  revalidateCyclePaths();
  redirect("/admin/cycle?status=mattermost-sender-disabled#mattermost-sender");
}
