import { SITE_NAME, SITE_URL } from "@/lib/site";
import { renderEmailTemplateBody } from "@/lib/email-content";
import { formatGraduateEmailCodeExpirationNotice } from "@/lib/graduate-verification-email-code";
import { createSmtpTransport, getSmtpConfig } from "@/lib/smtp";
import type { GraduateVerificationRequestKind } from "@/lib/graduate-verification";
import { resolveNotificationTemplate } from "@/lib/notification-templates/repository.server";
import { renderNotificationTemplate } from "@/lib/notification-templates/template";

async function renderEmailTemplate(
  eventKey: string,
  variables: Record<string, string | number>,
) {
  const template = await resolveNotificationTemplate(eventKey);
  return {
    subject: renderNotificationTemplate(template.titleTemplate, variables),
    ...renderEmailTemplateBody(template.bodyTemplate, template.bodyFormat, variables),
  };
}

type GraduateVerificationCodeEmailPurpose = "application" | "password_reset";
const DEFAULT_GRADUATE_EMAIL_CODE_TTL_SECONDS = 10 * 60;

export async function sendGraduateVerificationCodeEmail(input: {
  to: string;
  code: string;
  purpose?: GraduateVerificationCodeEmailPurpose;
  expiresInSeconds?: number;
}) {
  const smtpConfig = getSmtpConfig();
  const transporter = createSmtpTransport(smtpConfig);
  const purpose = input.purpose ?? "application";
  const expirationNotice = formatGraduateEmailCodeExpirationNotice(
    input.expiresInSeconds ?? DEFAULT_GRADUATE_EMAIL_CODE_TTL_SECONDS,
  );
  const template = await renderEmailTemplate(
    purpose === "password_reset"
      ? "email.graduate_password_reset_code"
      : "email.graduate_application_code",
    {
      siteName: SITE_NAME,
      code: input.code,
      expirationNotice,
    },
  );

  await transporter.sendMail({
    from: `${SITE_NAME} <${smtpConfig.fromEmail}>`,
    to: input.to,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });
}

export async function sendGraduateAccountSetupEmail(input: {
  to: string;
  displayName: string;
  token: string;
  requestKind?: GraduateVerificationRequestKind;
}) {
  const smtpConfig = getSmtpConfig();
  const transporter = createSmtpTransport(smtpConfig);
  const setupUrl = new URL("/auth/graduate/setup", SITE_URL);
  // Fragments never reach the server or HTTP Referer headers. The client reads
  // this opaque one-time token once, removes the fragment, then submits it only
  // in the same-origin password-setup request body.
  setupUrl.hash = new URLSearchParams({ token: input.token }).toString();
  const isExistingMemberRecovery = input.requestKind === "existing_member_recovery";
  const subjectLabel = isExistingMemberRecovery ? "기존 회원 계정 복구" : "수료생 계정 비밀번호 설정";
  const description = isExistingMemberRecovery
    ? `${input.displayName || "회원"}님, 기존 회원 복구가 승인되었습니다. 아래 링크에서 새 비밀번호를 설정해 주세요.`
    : `${input.displayName || "회원"}님, 수료생 인증이 승인되었습니다. 아래 링크에서 비밀번호를 설정해 주세요.`;
  const template = await renderEmailTemplate("email.graduate_account_setup", {
    siteName: SITE_NAME,
    subjectLabel,
    description,
    setupUrl: setupUrl.toString(),
  });

  await transporter.sendMail({
    from: `${SITE_NAME} <${smtpConfig.fromEmail}>`,
    to: input.to,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });
}

export async function sendGraduatePasswordResetEmail(input: {
  to: string;
  displayName: string;
  token: string;
}) {
  const smtpConfig = getSmtpConfig();
  const transporter = createSmtpTransport(smtpConfig);
  const setupUrl = new URL("/auth/graduate/setup", SITE_URL);
  // Keep a reset token out of the server-visible path and query string too.
  setupUrl.hash = new URLSearchParams({ token: input.token }).toString();
  const template = await renderEmailTemplate("email.graduate_password_reset", {
    siteName: SITE_NAME,
    displayName: input.displayName || "회원",
    setupUrl: setupUrl.toString(),
  });

  await transporter.sendMail({
    from: `${SITE_NAME} <${smtpConfig.fromEmail}>`,
    to: input.to,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });
}

export async function sendGraduateVerificationResubmissionEmail(input: {
  to: string;
  displayName: string;
  targets: string[];
  note: string | null;
  requestKind?: GraduateVerificationRequestKind;
}) {
  const smtpConfig = getSmtpConfig();
  const transporter = createSmtpTransport(smtpConfig);
  const applicationUrl = new URL("/auth/signup/graduate", SITE_URL);
  if (input.requestKind === "existing_member_recovery") {
    applicationUrl.searchParams.set("kind", "recovery");
  }
  const template = await renderEmailTemplate("email.graduate_resubmission", {
    siteName: SITE_NAME,
    displayName: input.displayName || "회원",
    targets: input.targets.join(", "),
    note: input.note ? `안내: ${input.note}` : "",
    applicationUrl: applicationUrl.toString(),
  });

  await transporter.sendMail({
    from: `${SITE_NAME} <${smtpConfig.fromEmail}>`,
    to: input.to,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });
}

export async function sendGraduateVerificationRejectionEmail(input: {
  to: string;
  displayName: string;
  reason: string;
  requestKind?: GraduateVerificationRequestKind;
}) {
  const smtpConfig = getSmtpConfig();
  const transporter = createSmtpTransport(smtpConfig);
  const applicationUrl = new URL("/auth/signup/graduate", SITE_URL);
  if (input.requestKind === "existing_member_recovery") {
    applicationUrl.searchParams.set("kind", "recovery");
  }
  const template = await renderEmailTemplate("email.graduate_rejection", {
    siteName: SITE_NAME,
    displayName: input.displayName || "회원",
    reason: input.reason,
    applicationUrl: applicationUrl.toString(),
  });

  await transporter.sendMail({
    from: `${SITE_NAME} <${smtpConfig.fromEmail}>`,
    to: input.to,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });
}
