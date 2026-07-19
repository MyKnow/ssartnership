import { randomInt } from "node:crypto";
import { createHmacDigest } from "@/lib/hmac.js";
import { MATTERMOST_VERIFICATION_CODE_TTL_SECONDS } from "@/lib/mattermost-code-expiration";
import { hashOpaqueToken, generateOpaqueToken } from "@/lib/password";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { MattermostVerificationRequest } from "@/lib/mattermost-code-input";
import { MattermostApiError, type MattermostUser } from "@/lib/mattermost/client";
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

async function findUserInGeneration(input: MattermostVerificationRequest & {
  generation: number;
}): Promise<MattermostVerificationTarget | null> {
  return withActiveMattermostSenderForGeneration(input.generation, async (session) => {
    const user = await session.getUserByUsername(input.username);
    const template = getMattermostSenderRoutingTemplate(input.generation);
    const team = await session.getTeamByName(template.teamName);
    const channel = await session.getChannelByName(team.id, template.channelName);
    const membership = await session.getChannelMember(channel.id, user.id);
    return membership ? { user, senderGeneration: input.generation } : null;
  });
}

async function resolveMattermostVerificationTarget(
  request: MattermostVerificationRequest,
): Promise<MattermostVerificationTarget | null> {
  if (request.generation > 0) {
    try {
      return await findUserInGeneration(request);
    } catch (error) {
      if (error instanceof MattermostApiError && error.code === "not_found") {
        return null;
      }
      throw error;
    }
  }

  const metadata = await mattermostSenderRepository.listMetadata();
  const activeGenerations = metadata
    .filter((sender) => sender.status === "active")
    .map((sender) => sender.generation)
    .sort((left, right) => right - left);
  if (activeGenerations.length === 0) {
    throw new MattermostSenderUnavailableError("sender_not_configured");
  }
  let lastUnavailable: unknown = null;
  for (const generation of activeGenerations) {
    try {
      const target = await findUserInGeneration({ ...request, generation });
      if (target) return target;
    } catch (error) {
      if (error instanceof MattermostApiError && error.code === "not_found") {
        continue;
      }
      lastUnavailable = error;
    }
  }
  if (lastUnavailable) {
    throw lastUnavailable;
  }
  return null;
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
  const challenge = generateOpaqueToken(24);
  const code = generateSixDigitCode();
  const target = await resolveMattermostVerificationTarget(input.request);

  const reservation = await reserveCode({
    purpose: input.purpose,
    challenge,
    code,
    target,
    requestGeneration: input.request.generation,
    requestUsername: input.request.username,
  });
  if (!reservation.accepted) {
    throw new MattermostCodeVerificationError("rate_limited");
  }

  if (!target) {
    await markCodeDelivery({
      codeId: reservation.codeId,
      sent: false,
      errorCode: "not_found",
    });
    return {
      challenge,
      expiresInSeconds: MATTERMOST_VERIFICATION_CODE_TTL_SECONDS,
      retryAfterSeconds: Math.ceil(RESEND_COOLDOWN_MS / 1000),
    };
  }

  try {
    const message = await buildVerificationMessage(input.purpose, code);
    await withActiveMattermostSenderForGeneration(
      target.senderGeneration,
      (session) => session.sendDirectMessage(
        target.user.id,
        message,
      ),
    );
    await markCodeDelivery({ codeId: reservation.codeId, sent: true });
  } catch (error) {
    await markCodeDelivery({
      codeId: reservation.codeId,
      sent: false,
      errorCode: toSafeMattermostErrorCode(error),
    }).catch(() => undefined);
  }

  return {
    challenge,
    expiresInSeconds: MATTERMOST_VERIFICATION_CODE_TTL_SECONDS,
    retryAfterSeconds: Math.ceil(RESEND_COOLDOWN_MS / 1000),
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
