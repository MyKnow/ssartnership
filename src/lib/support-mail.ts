import { BUG_REPORT_EMAIL, SITE_NAME } from "@/lib/site";

export type SupportMailTemplate = {
  to: string;
  subject: string;
  bodyLines: string[];
  mailtoHref: string;
  copyText: string;
};

function buildMailtoHref({
  to,
  subject,
  bodyLines,
}: {
  to: string;
  subject: string;
  bodyLines: string[];
}) {
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
    bodyLines.join("\n"),
  )}`;
}

function buildSupportMailTemplate({
  to,
  subject,
  bodyLines,
}: {
  to: string;
  subject: string;
  bodyLines: string[];
}): SupportMailTemplate {
  return {
    to,
    subject,
    bodyLines,
    mailtoHref: buildMailtoHref({ to, subject, bodyLines }),
    copyText: [
      `받는 사람: ${to}`,
      `제목: ${subject}`,
      "",
      bodyLines.join("\n"),
    ].join("\n"),
  };
}

export const TECH_SUPPORT_HREF = "/partner/support";
export const BUG_REPORT_HREF = "/support/bug-report";

export const TECH_SUPPORT_TEMPLATE = buildSupportMailTemplate({
  to: BUG_REPORT_EMAIL,
  subject: `[${SITE_NAME} 협력사 포털] 기술 지원 요청`,
  bodyLines: [
    "아래 내용을 작성해 주세요.",
    "",
    "1. 업체명 / 브랜드명:",
    "2. 담당자명:",
    "3. 로그인 이메일:",
    "4. 연락 가능한 전화번호:",
    "5. 문제가 발생한 화면 URL:",
    "6. 필요한 지원 내용:",
    "",
    "가능하다면 오류 화면 캡처나 상황 설명을 함께 첨부해 주세요.",
  ],
});

export const BUG_REPORT_TEMPLATE = buildSupportMailTemplate({
  to: BUG_REPORT_EMAIL,
  subject: `[${SITE_NAME}] 버그 제보`,
  bodyLines: [
    "아래 내용을 작성해 주세요.",
    "",
    "1. 문제가 발생한 페이지 URL:",
    "2. 사용한 기기 / 브라우저:",
    "3. 재현 방법:",
    "4. 기대한 동작:",
    "5. 실제 발생한 문제:",
    "6. 오류 메시지:",
    "",
    "가능하다면 화면 캡처나 녹화 파일을 함께 첨부해 주세요.",
  ],
});

export const TECH_SUPPORT_MAILTO_HREF = TECH_SUPPORT_TEMPLATE.mailtoHref;
export const BUG_REPORT_MAILTO_HREF = BUG_REPORT_TEMPLATE.mailtoHref;
