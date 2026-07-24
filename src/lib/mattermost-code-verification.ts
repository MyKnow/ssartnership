import { randomInt } from "node:crypto";
import { createHmacDigest } from "@/lib/hmac.js";
import { MATTERMOST_VERIFICATION_CODE_TTL_SECONDS } from "@/lib/mattermost-code-expiration";
import { hashOpaqueToken, generateOpaqueToken } from "@/lib/password";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { MattermostVerificationRequest } from "@/lib/mattermost-code-input";
import {
  MattermostApiError,
  type MattermostAuthenticatedSession,
  type MattermostUser,
} from "@/lib/mattermost/client";
import { mattermostSenderRepository } from "@/lib/mattermost-senders/repository";
import { getMattermostSenderRoutingTemplate } from "@/lib/mattermost-senders/routing";
import { resolveNotificationTemplate } from "@/lib/notification-templates/repository.server";
import { renderNotificationTemplate } from "@/lib/notification-templates/template";
import {
  MattermostSenderUnavailableError,
  withActiveMattermostSenderForGeneration,
} from "@/lib/mattermost-senders/service";

export type MattermostVerificationPurpose = "signup" | "reset_password";

type MattermostVerificationTarget = {
  user: MattermostUser;
  senderGeneration: number;
};

export type MattermostVerificationIssueTelemetry = {
  targetLookupMs: number;
  templateMs: number | null;
  reserveCodeMs: number;
  sendDmMs: number | null;
  deliveryMarkMs: number;
  totalMs: number;
  deliveryStatus: "sent" | "failed";
  deliveryErrorCode: string | null;
};

const CODE_TTL_MS = MATTERMOST_VERIFICATION_CODE_TTL_SECONDS * 1_000;
const RESEND_COOLDOWN_MS = 60 * 1000;

export class MattermostCodeVerificationError extends Error {
  readonly code: "invalid_request" | "rate_limited" | "storage_failed" | "unavailable";

  constructor(code: "invalid_request" | "rate_limited" | "storage_failed" | "unavailable") {
    super(code);
    this.name = "MattermostCodeVerificationError";
    this.code = code;
  }
}

function getCodeSecret() {
  const secret = process.env.USER_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new MattermostCodeVerificationError("storage_failed");
  }
  return secret;
}

function codeHash(purpose: MattermostVerificationPurpose, challenge: string, code: string) {
  return createHmacDigest(
    `mattermost-code:v1:${purpose}:${challenge}:${code}`,
    getCodeSecret(),
    "hex",
  );
}

function requestKeyHash(purpose: MattermostVerificationPurpose, username: string) {
  return createHmacDigest(
    `mattermost-code-request:v1:${purpose}:${username}`,
    getCodeSecret(),
    "hex",
  );
}

function generateSixDigitCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export { parseMattermostVerificationRequest } from "@/lib/mattermost-code-input";

function toSafeMattermostErrorCode(error: unknown) {
  if (error instanceof MattermostSenderUnavailableError) return error.code;
  if (error instanceof MattermostApiError) return error.code;
  return "unavailable";
}

const NO_MATTERMOST_VERIFICATION_TARGET = Symbol("no_mattermost_verification_target");

async function withMattermostVerificationTargetSession<T>(
  request: MattermostVerificationRequest,
  operation: (
    target: MattermostVerificationTarget | null,
    session: MattermostAuthenticatedSession | null,
  ) => Promise<T>,
): Promise<T> {
  const activeGenerations = request.generation > 0
    ? [request.generation]
    : (await mattermostSenderRepository.listMetadata())
      .filter((sender) => sender.status === "active")
      .map((sender) => sender.generation)
      .sort((left, right) => right - left);
  if (activeGenerations.length === 0) {
    throw new MattermostSenderUnavailableError("sender_not_configured");
  }

  let lastUnavailable: unknown = null;
  for (const generation of activeGenerations) {
    try {
      const result = await withActiveMattermostSenderForGeneration<
        T | typeof NO_MATTERMOST_VERIFICATION_TARGET
      >(generation, async (session) => {
        const user = await session.getUserByUsername(request.username);
        const template = getMattermostSenderRoutingTemplate(generation);
        const team = await session.getTeamByName(template.teamName);
        const channel = await session.getChannelByName(team.id, template.channelName);
        const membership = await session.getChannelMember(channel.id, user.id);
        if (!membership) return NO_MATTERMOST_VERIFICATION_TARGET;
        return operation({ user, senderGeneration: generation }, session);
      });
      if (result !== NO_MATTERMOST_VERIFICATION_TARGET) return result;
    } catch (error) {
      if (error instanceof MattermostApiError && error.code === "not_found") {
        if (request.generation > 0) return operation(null, null);
        continue;
      }
      if (request.generation > 0) throw error;
      lastUnavailable = error;
    }
  }
  if (lastUnavailable) throw lastUnavailable;
  return operation(null, null);
}

async function reserveCode(input: {
  purpose: MattermostVerificationPurpose;
  challenge: string;
  code: string;
  target: MattermostVerificationTarget | null;
  requestGeneration: number;
  requestUsername: string;
}) {
  const now = Date.now();
  const { data, error } = await getSupabaseAdminClient().rpc(
    "reserve_mattermost_verification_code",
    {
      p_purpose: input.purpose,
      p_challenge_hash: hashOpaqueToken(input.challenge),
      p_request_key_hash: requestKeyHash(input.purpose, input.requestUsername),
      p_mm_user_id: input.target?.user.id ?? null,
      p_subject_generation: input.target ? input.requestGeneration : null,
      p_sender_generation: input.target?.senderGeneration ?? null,
      p_code_hash: codeHash(input.purpose, input.challenge, input.code),
      p_expires_at: new Date(now + CODE_TTL_MS).toISOString(),
      p_resend_available_at: new Date(now + RESEND_COOLDOWN_MS).toISOString(),
    },
  );
  const row = Array.isArray(data) ? data[0] : null;
  if (error || !row || typeof row !== "object" || Array.isArray(row)) {
    throw new MattermostCodeVerificationError("storage_failed");
  }
  const value = row as Record<string, unknown>;
  if (typeof value.code_id !== "string" || typeof value.accepted !== "boolean") {
    throw new MattermostCodeVerificationError("storage_failed");
  }
  return { codeId: value.code_id, accepted: value.accepted };
}

async function markCodeDelivery(input: {
  codeId: string;
  sent: boolean;
  errorCode?: string | null;
}) {
  const { error } = await getSupabaseAdminClient().rpc(
    "mark_mattermost_verification_code_delivery",
    {
      p_code_id: input.codeId,
      p_sent: input.sent,
      p_error_code: input.errorCode ?? null,
    },
  );
  if (error) {
    throw new MattermostCodeVerificationError("storage_failed");
  }
}

async function buildVerificationMessage(purpose: MattermostVerificationPurpose, code: string) {
  const title = purpose === "signup" ? "회원가입" : "비밀번호 재설정";
  const template = await resolveNotificationTemplate(
    purpose === "signup" ? "mattermost.signup_code" : "mattermost.reset_password_code",
  );
  const variables = {
    title: `${title} 인증 코드`,
    code,
  };
  return [
    renderNotificationTemplate(template.titleTemplate, variables),
    renderNotificationTemplate(template.bodyTemplate, variables),
  ].filter(Boolean).join("\n\n");
}

/**
 * Always returns an opaque challenge. A missing account or failed DM never
 * changes the browser-visible shape, which avoids account enumeration.
 */
export async function issueMattermostVerificationCode(input: {
  purpose: MattermostVerificationPurpose;
  request: MattermostVerificationRequest;
}) {
  const startedAt = Date.now();
  const challenge = generateOpaqueToken(24);
  const code = generateSixDigitCode();
  const templateStartedAt = Date.now();
  const messagePromise = buildVerificationMessage(input.purpose, code).then(
    (message) => ({ message, error: null, durationMs: Date.now() - templateStartedAt }),
    (error: unknown) => ({ message: null, error, durationMs: Date.now() - templateStartedAt }),
  );
  let targetLookupMs = 0;
  let reserveCodeMs = 0;
  let sendDmMs: number | null = null;
  let templateMs: number | null = null;

  const delivery = await withMattermostVerificationTargetSession(
    input.request,
    async (target, session) => {
      targetLookupMs = Date.now() - startedAt;
      const reserveStartedAt = Date.now();
      const reservation = await reserveCode({
        purpose: input.purpose,
        challenge,
        code,
        target,
        requestGeneration: input.request.generation,
        requestUsername: input.request.username,
      });
      reserveCodeMs = Date.now() - reserveStartedAt;
      if (!reservation.accepted) {
        throw new MattermostCodeVerificationError("rate_limited");
      }
      if (!target || !session) {
        return { codeId: reservation.codeId, sent: false, errorCode: "not_found" } as const;
      }

      const messageResult = await messagePromise;
      templateMs = messageResult.durationMs;
      if (messageResult.error || !messageResult.message) {
        return {
          codeId: reservation.codeId,
          sent: false,
          errorCode: toSafeMattermostErrorCode(messageResult.error),
        } as const;
      }

      const sendStartedAt = Date.now();
      try {
        await session.sendDirectMessage(target.user.id, messageResult.message);
        sendDmMs = Date.now() - sendStartedAt;
        return { codeId: reservation.codeId, sent: true, errorCode: null } as const;
      } catch (error) {
        sendDmMs = Date.now() - sendStartedAt;
        return {
          codeId: reservation.codeId,
          sent: false,
          errorCode: toSafeMattermostErrorCode(error),
        } as const;
      }
    },
  );

  let deliveryMarkMs = 0;
  let deliveryStatus: "sent" | "failed" = delivery.sent ? "sent" : "failed";
  let deliveryErrorCode = delivery.errorCode;
  try {
    const markStartedAt = Date.now();
    await markCodeDelivery({
      codeId: delivery.codeId,
      sent: delivery.sent,
      errorCode: delivery.errorCode,
    });
    deliveryMarkMs = Date.now() - markStartedAt;
  } catch (error) {
    deliveryStatus = "failed";
    deliveryErrorCode = toSafeMattermostErrorCode(error);
    const markStartedAt = Date.now();
    await markCodeDelivery({
      codeId: delivery.codeId,
      sent: false,
      errorCode: deliveryErrorCode,
    }).catch(() => undefined);
    deliveryMarkMs = Date.now() - markStartedAt;
  }

  return {
    challenge,
    expiresInSeconds: MATTERMOST_VERIFICATION_CODE_TTL_SECONDS,
    retryAfterSeconds: Math.ceil(RESEND_COOLDOWN_MS / 1000),
    telemetry: {
      targetLookupMs,
      templateMs,
      reserveCodeMs,
      sendDmMs,
      deliveryMarkMs,
      totalMs: Date.now() - startedAt,
      deliveryStatus,
      deliveryErrorCode,
    } satisfies MattermostVerificationIssueTelemetry,
  };
}

export async function consumeMattermostVerificationCode(input: {
  purpose: MattermostVerificationPurpose;
  challenge: unknown;
  code: unknown;
}) {
  const challenge = typeof input.challenge === "string" ? input.challenge : "";
  const code = typeof input.code === "string" ? input.code.trim() : "";
  if (!challenge || !/^\d{6}$/.test(code)) {
    return null;
  }
  const { data, error } = await getSupabaseAdminClient().rpc(
    "consume_mattermost_verification_code",
    {
      p_purpose: input.purpose,
      p_challenge_hash: hashOpaqueToken(challenge),
      p_code_hash: codeHash(input.purpose, challenge, code),
    },
  );
  const row = Array.isArray(data) ? data[0] : null;
  if (error || !row || typeof row !== "object" || Array.isArray(row)) {
    throw new MattermostCodeVerificationError("storage_failed");
  }
  const value = row as Record<string, unknown>;
  if (
    value.verified !== true
    || typeof value.mm_user_id !== "string"
    || !value.mm_user_id
    || !Number.isSafeInteger(value.sender_generation)
    || !Number.isSafeInteger(value.subject_generation)
  ) {
    return null;
  }
  return {
    mmUserId: value.mm_user_id,
    subjectGeneration: value.subject_generation as number,
    senderGeneration: value.sender_generation as number,
  };
}
