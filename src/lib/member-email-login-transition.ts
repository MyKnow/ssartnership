import { SITE_NAME, SITE_URL } from "@/lib/site";
import { normalizeMemberEmail } from "@/lib/member-domain";
import { generateOpaqueToken, hashOpaqueToken } from "@/lib/password";
import { createSmtpTransport, getSmtpConfig } from "@/lib/smtp";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { buildReservedMemberIdentifierHashes } from "@/lib/member-identifier-reservations";
import {
  isMattermostLoginDisabledReason,
  type MattermostLoginDisabledReason,
} from "@/lib/member-mattermost-auth";

export {
  isMattermostLoginDisabledReason,
  MATTERMOST_LOGIN_DISABLED_REASONS,
  type MattermostLoginDisabledReason,
} from "@/lib/member-mattermost-auth";

const EMAIL_LOGIN_TRANSITION_TTL_MS = 24 * 60 * 60 * 1000;

export type MemberEmailLoginTransition = {
  candidateEmail: string;
  reason: MattermostLoginDisabledReason;
  status: "pending_delivery" | "email_sent" | "completed" | "cancelled";
  emailSentAt: string | null;
  completedAt: string | null;
};

type TransitionRow = {
  candidate_email: string;
  reason: string;
  status: string;
  email_sent_at: string | null;
  completed_at: string | null;
};

type MemberMattermostLoginStateRow = {
  mattermost_account_id: string | null;
  mattermost_login_disabled_at: string | null;
  mattermost_login_disabled_reason: string | null;
};

export class MemberEmailLoginTransitionError extends Error {
  readonly code:
    | "invalid_email"
    | "invalid_reason"
    | "member_missing"
    | "member_not_linked"
    | "email_mismatch"
    | "email_exists"
    | "email_reserved"
    | "already_completed"
    | "delivery_failed"
    | "operation_failed";

  constructor(
    code:
      | "invalid_email"
      | "invalid_reason"
      | "member_missing"
      | "member_not_linked"
      | "email_mismatch"
      | "email_exists"
      | "email_reserved"
      | "already_completed"
      | "delivery_failed"
      | "operation_failed",
  ) {
    super(code);
    this.name = "MemberEmailLoginTransitionError";
    this.code = code;
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildEmailLoginSetupUrl(token: string) {
  const url = new URL("/auth/member/setup", SITE_URL);
  // A fragment is deliberately omitted from HTTP request paths and Referer.
  url.hash = new URLSearchParams({ token }).toString();
  return url.toString();
}

async function sendEmailLoginTransitionEmail(input: {
  email: string;
  displayName: string;
  token: string;
}) {
  const smtpConfig = getSmtpConfig();
  const transport = createSmtpTransport(smtpConfig);
  const setupUrl = buildEmailLoginSetupUrl(input.token);
  const safeName = escapeHtml(input.displayName || "회원");
  const safeUrl = escapeHtml(setupUrl);

  await transport.sendMail({
    from: `${SITE_NAME} <${smtpConfig.fromEmail}>`,
    to: input.email,
    subject: `[${SITE_NAME}] 이메일 로그인 설정`,
    text: [
      `${input.displayName || "회원"}님, Mattermost 로그인을 이메일 로그인으로 전환합니다.`,
      "아래 링크에서 이메일 로그인용 비밀번호를 설정해 주세요.",
      "",
      setupUrl,
      "",
      "링크는 24시간 동안 한 번만 사용할 수 있습니다.",
    ].join("\n"),
    html: `<div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.7"><h2>이메일 로그인 설정</h2><p>${safeName}님, Mattermost 로그인을 이메일 로그인으로 전환합니다.</p><p><a href="${safeUrl}">이메일 로그인 비밀번호 설정하기</a></p><p>링크는 24시간 동안 한 번만 사용할 수 있습니다.</p></div>`,
  });
}

function toTransitionError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("member_email_login_transition_member_missing")) {
    return new MemberEmailLoginTransitionError("member_missing");
  }
  if (message.includes("member_email_login_transition_member_not_linked")) {
    return new MemberEmailLoginTransitionError("member_not_linked");
  }
  if (message.includes("member_email_login_transition_email_mismatch")) {
    return new MemberEmailLoginTransitionError("email_mismatch");
  }
  if (message.includes("member_email_login_transition_email_exists")) {
    return new MemberEmailLoginTransitionError("email_exists");
  }
  if (message.includes("member_email_login_transitions_email_unique")) {
    return new MemberEmailLoginTransitionError("email_exists");
  }
  if (message.includes("member_email_login_transition_email_reserved")) {
    return new MemberEmailLoginTransitionError("email_reserved");
  }
  if (message.includes("member_email_login_transition_already_completed")) {
    return new MemberEmailLoginTransitionError("already_completed");
  }
  return new MemberEmailLoginTransitionError("operation_failed");
}

function toTransition(row: TransitionRow | null): MemberEmailLoginTransition | null {
  if (
    !row
    || !isMattermostLoginDisabledReason(row.reason)
    || !["pending_delivery", "email_sent", "completed", "cancelled"].includes(row.status)
  ) {
    return null;
  }

  return {
    candidateEmail: row.candidate_email,
    reason: row.reason,
    status: row.status as MemberEmailLoginTransition["status"],
    emailSentAt: row.email_sent_at,
    completedAt: row.completed_at,
  };
}

export async function getMemberMattermostLoginState(memberId: string) {
  const { data, error } = await getSupabaseAdminClient()
    .from("members")
    .select(
      "mattermost_account_id,mattermost_login_disabled_at,mattermost_login_disabled_reason",
    )
    .eq("id", memberId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !data) {
    return null;
  }

  const member = data as MemberMattermostLoginStateRow;
  return {
    hasMattermostAccount: Boolean(member.mattermost_account_id),
    disabledAt: member.mattermost_login_disabled_at,
    disabledReason: isMattermostLoginDisabledReason(
      member.mattermost_login_disabled_reason,
    )
      ? member.mattermost_login_disabled_reason
      : null,
  };
}

export async function getMemberEmailLoginTransition(memberId: string) {
  const { data, error } = await getSupabaseAdminClient()
    .from("member_email_login_transitions")
    .select("candidate_email,reason,status,email_sent_at,completed_at")
    .eq("member_id", memberId)
    .maybeSingle();
  if (error) {
    throw new MemberEmailLoginTransitionError("operation_failed");
  }
  return toTransition((data as TransitionRow | null) ?? null);
}

export async function markMemberMattermostLoginUnavailable(input: {
  memberId: string;
  reason: MattermostLoginDisabledReason;
}) {
  if (!isMattermostLoginDisabledReason(input.reason)) {
    throw new MemberEmailLoginTransitionError("invalid_reason");
  }
  const { error } = await getSupabaseAdminClient().rpc(
    "disable_member_mattermost_login",
    {
      p_member_id: input.memberId,
      p_reason: input.reason,
    },
  );
  if (error) {
    throw toTransitionError(error);
  }
}

export async function disableMattermostLoginsForGeneration(generation: number) {
  if (!Number.isInteger(generation) || generation < 1 || generation > 99) {
    throw new MemberEmailLoginTransitionError("invalid_reason");
  }
  const { data, error } = await getSupabaseAdminClient().rpc(
    "disable_generation_mattermost_logins",
    { p_generation: generation },
  );
  if (error || typeof data !== "number") {
    throw new MemberEmailLoginTransitionError("operation_failed");
  }
  return data;
}

export async function isMattermostLoginDisabledForGeneration(generation: number) {
  if (!Number.isInteger(generation) || generation < 1 || generation > 99) {
    return false;
  }
  const { data, error } = await getSupabaseAdminClient()
    .from("member_mattermost_disabled_generations")
    .select("generation")
    .eq("generation", generation)
    .maybeSingle();
  if (error) {
    throw new MemberEmailLoginTransitionError("operation_failed");
  }
  return Boolean(data);
}

export async function issueMemberEmailLoginTransition(input: {
  memberId: string;
  email: unknown;
  reason: MattermostLoginDisabledReason;
  initiatedByAdminId: string;
}) {
  const email = normalizeMemberEmail(input.email);
  if (!email) {
    throw new MemberEmailLoginTransitionError("invalid_email");
  }
  if (!isMattermostLoginDisabledReason(input.reason)) {
    throw new MemberEmailLoginTransitionError("invalid_reason");
  }
  const emailReservationHash = buildReservedMemberIdentifierHashes({
    emailNormalized: email,
  }).find((reservation) => reservation.identifierKind === "email")?.identifierHash;
  if (!emailReservationHash) {
    throw new MemberEmailLoginTransitionError("invalid_email");
  }

  const token = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + EMAIL_LOGIN_TRANSITION_TTL_MS).toISOString();
  const supabase = getSupabaseAdminClient();
  const { data: tokenId, error } = await supabase.rpc(
    "begin_member_email_login_transition",
    {
      p_member_id: input.memberId,
      p_candidate_email: email,
      p_email_reservation_hash: emailReservationHash,
      p_reason: input.reason,
      p_initiated_by_admin_id: input.initiatedByAdminId,
      p_token_hash: hashOpaqueToken(token),
      p_expires_at: expiresAt,
    },
  );
  if (error || typeof tokenId !== "string") {
    throw toTransitionError(error);
  }

  const { data: member, error: memberError } = await supabase
    .from("members")
    .select("display_name")
    .eq("id", input.memberId)
    .is("deleted_at", null)
    .maybeSingle();
  if (memberError || !member) {
    throw new MemberEmailLoginTransitionError("operation_failed");
  }

  try {
    await sendEmailLoginTransitionEmail({
      email,
      displayName: String(member.display_name ?? "회원"),
      token,
    });
  } catch {
    throw new MemberEmailLoginTransitionError("delivery_failed");
  }

  const { error: sentError } = await supabase.rpc(
    "mark_member_email_login_transition_sent",
    { p_token_id: tokenId },
  );
  if (sentError) {
    // The opaque link is already safe and valid; a later resend can repair
    // this operational status without invalidating the email that was sent.
    console.error("member email login transition delivery status update failed");
  }

  return { expiresAt };
}
