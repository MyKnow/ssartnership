import { SITE_NAME } from "@/lib/site";
import { createSmtpTransport, getSmtpConfig } from "@/lib/smtp";
import { MEMBER_EMAIL_VERIFICATION_CODE_TTL_SECONDS } from "@/lib/member-email-verification";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendMemberEmailVerificationCode(input: {
  to: string;
  code: string;
}) {
  const smtpConfig = getSmtpConfig();
  const transporter = createSmtpTransport(smtpConfig);
  const safeCode = escapeHtml(input.code);
  const expiresInMinutes = Math.floor(
    MEMBER_EMAIL_VERIFICATION_CODE_TTL_SECONDS / 60,
  );

  await transporter.sendMail({
    from: `${SITE_NAME} <${smtpConfig.fromEmail}>`,
    to: input.to,
    subject: `[${SITE_NAME}] 이메일 인증 코드`,
    text: [
      "이메일 로그인 등록 또는 변경을 위한 인증 코드입니다.",
      "",
      `인증 코드: ${input.code}`,
      "",
      `코드는 ${expiresInMinutes}분 동안 사용할 수 있습니다. 본인이 요청하지 않았다면 이 메일을 무시해 주세요.`,
    ].join("\n"),
    html: `
      <div style="font-family: 'Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif; color: #0f172a; line-height: 1.7;">
        <h2 style="margin: 0 0 12px;">이메일 인증</h2>
        <p style="margin: 0 0 16px; color: #334155;">이메일 로그인 등록 또는 변경을 위한 인증 코드입니다.</p>
        <p style="margin: 0; border: 1px solid #cbd5e1; border-radius: 16px; padding: 16px; background: #f8fafc; font-size: 24px; font-weight: 700; letter-spacing: 0.16em;">${safeCode}</p>
        <p style="margin: 16px 0 0; color: #475569;">코드는 ${expiresInMinutes}분 동안 사용할 수 있습니다. 본인이 요청하지 않았다면 이 메일을 무시해 주세요.</p>
      </div>
    `,
  });
}
