import nodemailer from "nodemailer";
import { SITE_NAME } from "./site";

function getSmtpCredentials() {
  const smtpUser = process.env.NAVER_SMTP_USER;
  const smtpPass = process.env.NAVER_SMTP_PASS;
  if (!smtpUser || !smtpPass) {
    throw new Error("메일 설정이 누락되었습니다.");
  }
  return { smtpUser, smtpPass };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toHtml(value: string) {
  return escapeHtml(value).replace(/\n/g, "<br />");
}

export async function sendPartnerPortalTemporaryPasswordEmail(input: {
  to: string;
  displayName: string;
  loginId: string;
  temporaryPassword: string;
}) {
  const { smtpUser, smtpPass } = getSmtpCredentials();
  const transporter = nodemailer.createTransport({
    host: "smtp.naver.com",
    port: 465,
    secure: true,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  const safeDisplayName = toHtml(input.displayName || "담당자");
  const safeLoginId = toHtml(input.loginId);
  const safeTemporaryPassword = toHtml(input.temporaryPassword);

  await transporter.sendMail({
    from: `${SITE_NAME} <${smtpUser}>`,
    to: input.to,
    subject: `[${SITE_NAME}] 협력사 포털 임시 비밀번호 안내`,
    text: [
      `${input.displayName || "담당자"}님,`,
      "",
      `요청하신 협력사 포털 임시 비밀번호입니다.`,
      `로그인 아이디: ${input.loginId}`,
      `임시 비밀번호: ${input.temporaryPassword}`,
      "",
      "로그인 후 반드시 새 비밀번호로 변경해 주세요.",
    ].join("\n"),
    html: `
      <div style="font-family: 'Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif; color: #0f172a; line-height: 1.7;">
        <h2 style="margin: 0 0 12px;">협력사 포털 임시 비밀번호 안내</h2>
        <p style="margin: 0 0 16px; color: #334155;">
          안녕하세요 ${safeDisplayName}님, 요청하신 임시 비밀번호를 전달드립니다.
          로그인 후 반드시 새 비밀번호로 변경해 주세요.
        </p>
        <div style="border: 1px solid #e2e8f0; border-radius: 16px; padding: 16px; background: #f8fafc;">
          <p style="margin: 0 0 8px;"><strong>로그인 아이디</strong><br />${safeLoginId}</p>
          <p style="margin: 0;"><strong>임시 비밀번호</strong><br />${safeTemporaryPassword}</p>
        </div>
        <p style="margin: 16px 0 0; color: #334155;">
          ${SITE_NAME} 협력사 포털에서 로그인 후, 비밀번호 변경 화면에서 새 비밀번호를 설정해 주세요.
        </p>
      </div>
    `,
  });
}

export async function sendPartnerPortalInitialSetupEmail(input: {
  to: string;
  displayName: string;
  loginId: string;
  setupUrl: string;
}) {
  const { smtpUser, smtpPass } = getSmtpCredentials();
  const transporter = nodemailer.createTransport({
    host: "smtp.naver.com",
    port: 465,
    secure: true,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  const safeDisplayName = toHtml(input.displayName || "담당자");
  const safeLoginId = toHtml(input.loginId);
  const safeSetupUrl = escapeHtml(input.setupUrl);

  await transporter.sendMail({
    from: `${SITE_NAME} <${smtpUser}>`,
    to: input.to,
    subject: `[${SITE_NAME}] 협력사 포털 초기 설정 안내`,
    text: [
      `${input.displayName || "담당자"}님,`,
      "",
      "협력사 포털 초기 설정 링크를 전송드립니다.",
      `로그인 아이디: ${input.loginId}`,
      `초기 설정 URL: ${input.setupUrl}`,
      "",
      "링크로 이동해 새 비밀번호를 설정해 주세요.",
    ].join("\n"),
    html: `
      <div style="font-family: 'Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif; color: #0f172a; line-height: 1.7;">
        <h2 style="margin: 0 0 12px;">협력사 포털 초기 설정 안내</h2>
        <p style="margin: 0 0 16px; color: #334155;">
          안녕하세요 ${safeDisplayName}님, 협력사 포털 초기 설정 링크를 전달드립니다.
          아래 링크로 이동해 새 비밀번호 설정을 완료해 주세요.
        </p>
        <div style="border: 1px solid #e2e8f0; border-radius: 16px; padding: 16px; background: #f8fafc;">
          <p style="margin: 0 0 8px;"><strong>로그인 아이디</strong><br />${safeLoginId}</p>
          <p style="margin: 0 0 8px;"><strong>초기 설정 URL</strong><br /><a href="${safeSetupUrl}" style="color: #2563eb; word-break: break-all;">${safeSetupUrl}</a></p>
        </div>
        <p style="margin: 16px 0 0; color: #334155;">
          초기 설정을 마치면 해당 계정으로 협력사 포털에 로그인할 수 있습니다.
        </p>
      </div>
    `,
  });
}
