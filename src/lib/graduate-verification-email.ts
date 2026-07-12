import { SITE_NAME, SITE_URL } from "@/lib/site";
import { createSmtpTransport, getSmtpConfig } from "@/lib/smtp";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type GraduateVerificationCodeEmailPurpose = "application" | "password_reset";

function getCodeEmailCopy(purpose: GraduateVerificationCodeEmailPurpose) {
  if (purpose === "password_reset") {
    return {
      heading: "수료생 비밀번호 재설정",
      subject: `[${SITE_NAME}] 수료생 비밀번호 재설정 코드`,
      description: "수료생 계정의 비밀번호 재설정을 위한 이메일 인증 코드입니다.",
    };
  }
  return {
    heading: "수료생 이메일 인증",
    subject: `[${SITE_NAME}] 수료생 인증 코드`,
    description: "수료생 가입을 위한 이메일 인증 코드입니다.",
  };
}

export async function sendGraduateVerificationCodeEmail(input: {
  to: string;
  code: string;
  purpose?: GraduateVerificationCodeEmailPurpose;
}) {
  const smtpConfig = getSmtpConfig();
  const transporter = createSmtpTransport(smtpConfig);
  const code = escapeHtml(input.code);
  const copy = getCodeEmailCopy(input.purpose ?? "application");

  await transporter.sendMail({
    from: `${SITE_NAME} <${smtpConfig.fromEmail}>`,
    to: input.to,
    subject: copy.subject,
    text: [
      copy.description,
      "",
      `인증 코드: ${input.code}`,
      "",
      "코드는 10분 동안만 유효합니다. 본인이 요청하지 않았다면 이 메일을 무시해 주세요.",
    ].join("\n"),
    html: `
      <div style="font-family: 'Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif; color: #0f172a; line-height: 1.7;">
        <h2 style="margin: 0 0 12px;">${copy.heading}</h2>
        <p style="margin: 0 0 16px; color: #334155;">${copy.description}</p>
        <p style="margin: 0; border: 1px solid #cbd5e1; border-radius: 16px; padding: 16px; background: #f8fafc; font-size: 24px; font-weight: 700; letter-spacing: 0.16em;">${code}</p>
        <p style="margin: 16px 0 0; color: #475569;">코드는 10분 동안만 유효합니다. 본인이 요청하지 않았다면 이 메일을 무시해 주세요.</p>
      </div>
    `,
  });
}

export async function sendGraduateAccountSetupEmail(input: {
  to: string;
  displayName: string;
  token: string;
}) {
  const smtpConfig = getSmtpConfig();
  const transporter = createSmtpTransport(smtpConfig);
  const setupUrl = new URL("/auth/graduate/setup", SITE_URL);
  // Fragments never reach the server or HTTP Referer headers. The client reads
  // this opaque one-time token once, removes the fragment, then submits it only
  // in the same-origin password-setup request body.
  setupUrl.hash = new URLSearchParams({ token: input.token }).toString();
  const safeName = escapeHtml(input.displayName || "회원");
  const safeSetupUrl = escapeHtml(setupUrl.toString());

  await transporter.sendMail({
    from: `${SITE_NAME} <${smtpConfig.fromEmail}>`,
    to: input.to,
    subject: `[${SITE_NAME}] 수료생 계정 비밀번호 설정`,
    text: [
      `${input.displayName || "회원"}님, 수료생 인증이 승인되었습니다.`,
      "",
      "아래 링크에서 비밀번호를 설정해 주세요.",
      setupUrl.toString(),
      "",
      "링크는 24시간 동안 한 번만 사용할 수 있습니다.",
    ].join("\n"),
    html: `
      <div style="font-family: 'Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif; color: #0f172a; line-height: 1.7;">
        <h2 style="margin: 0 0 12px;">수료생 계정 설정</h2>
        <p style="margin: 0 0 16px; color: #334155;">${safeName}님, 수료생 인증이 승인되었습니다. 아래 링크에서 비밀번호를 설정해 주세요.</p>
        <p style="margin: 0;"><a href="${safeSetupUrl}" style="display: inline-block; border-radius: 12px; padding: 12px 16px; background: #1e4078; color: #ffffff; text-decoration: none; font-weight: 700;">비밀번호 설정하기</a></p>
        <p style="margin: 16px 0 0; color: #475569;">링크는 24시간 동안 한 번만 사용할 수 있습니다.</p>
      </div>
    `,
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
  const safeName = escapeHtml(input.displayName || "회원");
  const safeSetupUrl = escapeHtml(setupUrl.toString());

  await transporter.sendMail({
    from: `${SITE_NAME} <${smtpConfig.fromEmail}>`,
    to: input.to,
    subject: `[${SITE_NAME}] 수료생 비밀번호 재설정`,
    text: [
      `${input.displayName || "회원"}님, 비밀번호 재설정 요청을 확인했습니다.`,
      "",
      "아래 링크에서 새 비밀번호를 설정해 주세요.",
      setupUrl.toString(),
      "",
      "링크는 24시간 동안 한 번만 사용할 수 있습니다. 본인이 요청하지 않았다면 이 메일을 무시해 주세요.",
    ].join("\n"),
    html: `
      <div style="font-family: 'Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif; color: #0f172a; line-height: 1.7;">
        <h2 style="margin: 0 0 12px;">수료생 비밀번호 재설정</h2>
        <p style="margin: 0 0 16px; color: #334155;">${safeName}님, 비밀번호 재설정 요청을 확인했습니다. 아래 링크에서 새 비밀번호를 설정해 주세요.</p>
        <p style="margin: 0;"><a href="${safeSetupUrl}" style="display: inline-block; border-radius: 12px; padding: 12px 16px; background: #1e4078; color: #ffffff; text-decoration: none; font-weight: 700;">새 비밀번호 설정하기</a></p>
        <p style="margin: 16px 0 0; color: #475569;">링크는 24시간 동안 한 번만 사용할 수 있습니다. 본인이 요청하지 않았다면 이 메일을 무시해 주세요.</p>
      </div>
    `,
  });
}

export async function sendGraduateVerificationResubmissionEmail(input: {
  to: string;
  displayName: string;
  targets: string[];
  note: string | null;
}) {
  const smtpConfig = getSmtpConfig();
  const transporter = createSmtpTransport(smtpConfig);
  const applicationUrl = new URL("/auth/signup/graduate", SITE_URL).toString();
  const safeName = escapeHtml(input.displayName || "회원");
  const safeTargets = escapeHtml(input.targets.join(", "));
  const safeNote = input.note ? escapeHtml(input.note) : null;
  const safeApplicationUrl = escapeHtml(applicationUrl);

  await transporter.sendMail({
    from: `${SITE_NAME} <${smtpConfig.fromEmail}>`,
    to: input.to,
    subject: `[${SITE_NAME}] 수료생 인증 보완 요청`,
    text: [
      `${input.displayName || "회원"}님, 수료생 인증 신청에 보완이 필요합니다.`,
      `보완 항목: ${input.targets.join(", ")}`,
      input.note ? `안내: ${input.note}` : null,
      "",
      "아래 페이지에서 같은 이메일로 다시 인증한 뒤 보완 요청된 항목만 제출해 주세요.",
      applicationUrl,
    ].filter((value): value is string => Boolean(value)).join("\n"),
    html: `
      <div style="font-family: 'Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif; color: #0f172a; line-height: 1.7;">
        <h2 style="margin: 0 0 12px;">수료생 인증 보완 요청</h2>
        <p style="margin: 0 0 12px; color: #334155;">${safeName}님, 수료생 인증 신청에 보완이 필요합니다.</p>
        <p style="margin: 0 0 8px; color: #334155;"><strong>보완 항목:</strong> ${safeTargets}</p>
        ${safeNote ? `<p style="margin: 0 0 16px; color: #475569;"><strong>안내:</strong> ${safeNote}</p>` : ""}
        <p style="margin: 0;"><a href="${safeApplicationUrl}" style="display: inline-block; border-radius: 12px; padding: 12px 16px; background: #1e4078; color: #ffffff; text-decoration: none; font-weight: 700;">보완 제출하기</a></p>
      </div>
    `,
  });
}
