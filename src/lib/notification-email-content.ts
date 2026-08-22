import {
  renderEmailTemplateBody,
  renderTransactionalEmail,
  type RenderedEmailBody,
} from "@/lib/email-content";
import type { NotificationTemplateBodyFormat } from "@/lib/notification-templates/catalog";
import { SITE_NAME, SITE_URL } from "@/lib/site";

type EmailVariables = Record<
  string,
  string | number | null | undefined
>;

type ResolvedNotificationEmailContentInput = Readonly<{
  eventKey: string;
  bodyTemplate: string;
  bodyFormat: NotificationTemplateBodyFormat;
  isCustomized: boolean;
  variables: EmailVariables;
}>;

export const DEFAULT_NOTIFICATION_EMAIL_EVENT_KEYS = [
  "email.member_email_verification_code",
  "email.member_email_login_transition",
  "email.manual_member_setup",
  "email.manual_member_setup_reissue",
  "email.manual_member_password_reset",
  "email.partner_suggestion_received",
  "email.partner_temporary_password",
  "email.partner_initial_setup",
  "email.partner_operational",
  "email.partner_operational.expiring_partner",
  "email.partner_operational.plan_changed",
  "email.partner_operational.plan_upgrade_requested",
  "email.partner_operational.plan_upgrade_approved",
  "email.partner_operational.plan_upgrade_rejected",
  "email.partner_operational.metrics_digest",
] as const;

type DefaultNotificationEmailEventKey =
  (typeof DEFAULT_NOTIFICATION_EMAIL_EVENT_KEYS)[number];

function getText(
  variables: EmailVariables,
  name: string,
  fallback: string,
) {
  const value = variables[name];
  if (value === null || value === undefined) {
    return fallback;
  }
  const normalized = String(value).trim();
  return normalized || fallback;
}

function getFirstText(
  variables: EmailVariables,
  names: readonly string[],
  fallback: string,
) {
  for (const name of names) {
    const value = variables[name];
    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value).trim();
    }
  }
  return fallback;
}

function getDisplayName(variables: EmailVariables, fallback = "담당자") {
  return getText(variables, "displayName", fallback);
}

function getActionUrl(variables: EmailVariables, name: string) {
  const value = getText(variables, name, SITE_URL);
  if (value.startsWith("//")) {
    throw new Error("이메일 동작 URL이 올바르지 않습니다.");
  }
  return new URL(value, SITE_URL).toString();
}

function renderMemberVerificationCode(variables: EmailVariables) {
  const expiresInMinutes = getText(variables, "expiresInMinutes", "10");
  return renderTransactionalEmail({
    preheader: "이메일 로그인 등록 또는 변경을 위한 인증 코드입니다.",
    kicker: "이메일 인증",
    title: "이메일 인증 코드",
    lead: [
      "이메일 로그인 등록 또는 변경을 계속하려면 아래 인증 코드를 입력해 주세요.",
    ],
    code: {
      label: "6자리 인증 코드",
      value: getText(variables, "code", "000000"),
    },
    panels: [
      {
        tone: "info",
        title: `코드는 발급 후 ${expiresInMinutes}분 동안 한 번만 사용할 수 있습니다.`,
        body: [
          "본인이 요청하지 않았다면 별도의 조치를 하지 않아도 됩니다. 인증 코드를 다른 사람에게 전달하지 마세요.",
        ],
      },
    ],
  });
}

function renderMemberEmailLoginTransition(variables: EmailVariables) {
  const displayName = getDisplayName(variables, "회원");
  return renderTransactionalEmail({
    preheader: "Mattermost 로그인을 이메일 로그인으로 전환해 주세요.",
    kicker: "로그인 전환",
    title: ["이메일 로그인을", "설정해 주세요"],
    lead: [
      `${displayName}님, Mattermost 로그인을 이메일 로그인으로 전환합니다.`,
      "아래 버튼을 눌러 이메일 로그인용 비밀번호를 설정해 주세요.",
    ],
    action: {
      label: "이메일 로그인 설정하기",
      url: getActionUrl(variables, "setupUrl"),
    },
  });
}

function renderManualMemberSetup(variables: EmailVariables) {
  const displayName = getDisplayName(variables, "회원");
  return renderTransactionalEmail({
    preheader: "싸트너십 계정 설정을 완료해 주세요.",
    kicker: "계정 설정",
    title: ["계정 설정을", "완료해 주세요"],
    lead: [
      `${displayName}님, ${SITE_NAME} 계정이 준비되었습니다.`,
      "아래 버튼을 눌러 사용할 비밀번호를 설정해 주세요.",
    ],
    action: {
      label: "비밀번호 설정하기",
      url: getActionUrl(variables, "setupUrl"),
    },
  });
}

function renderManualMemberSetupReissue(variables: EmailVariables) {
  const displayName = getDisplayName(variables, "회원");
  return renderTransactionalEmail({
    preheader: "계정 설정을 계속할 수 있도록 새 링크를 보내드렸습니다.",
    kicker: "계정 설정",
    title: ["계정 설정을", "완료해 주세요"],
    lead: [
      `${displayName}님, 계정 설정을 계속할 수 있도록 새 링크를 보내드렸습니다.`,
      "아래 버튼을 눌러 사용할 비밀번호를 설정해 주세요.",
    ],
    action: {
      label: "비밀번호 설정하기",
      url: getActionUrl(variables, "setupUrl"),
    },
  });
}

function renderManualMemberPasswordReset(variables: EmailVariables) {
  const displayName = getDisplayName(variables, "회원");
  return renderTransactionalEmail({
    preheader: "요청하신 비밀번호 재설정 링크를 보내드렸습니다.",
    kicker: "계정 보안",
    title: ["비밀번호를", "다시 설정해 주세요"],
    lead: [
      `${displayName}님, 요청하신 비밀번호 재설정 링크를 보내드렸습니다.`,
      "아래 버튼을 눌러 새 비밀번호를 설정해 주세요.",
    ],
    action: {
      label: "비밀번호 재설정하기",
      url: getActionUrl(variables, "setupUrl"),
    },
  });
}

function renderPartnerSuggestionReceived(variables: EmailVariables) {
  const contactName = getText(variables, "contactName", "담당자");
  const contactRole = getText(variables, "contactRole", "");
  const recipientLabel = [contactName, contactRole].filter(Boolean).join(" ");
  return renderTransactionalEmail({
    preheader: "보내주신 제휴 제안을 접수했습니다.",
    kicker: "제휴 제안",
    title: "제안을 접수했습니다",
    titleSingleLine: true,
    lead: [
      `${recipientLabel}님, ${SITE_NAME}에 보내주신 제휴 제안을 접수했습니다.`,
      "담당자가 내용을 확인한 뒤 안내드리겠습니다.",
    ],
    panels: [
      {
        tone: "info",
        title: "접수 내용",
        body: [
          `파트너사명 · ${getText(variables, "companyName", "-")}`,
          `사업 분야 · ${getText(variables, "businessArea", "-")}`,
          `제휴 조건 · ${getText(variables, "partnershipConditions", "-")}`,
          `담당자 이메일 · ${getText(variables, "contactEmail", "-")}`,
          `회사 사이트 · ${getText(variables, "companyUrl", "-")}`,
        ],
      },
    ],
  });
}

function renderPartnerTemporaryPassword(variables: EmailVariables) {
  const displayName = getDisplayName(variables);
  return renderTransactionalEmail({
    preheader: "파트너 포털 임시 비밀번호를 확인해 주세요.",
    kicker: "계정 보안",
    title: ["임시 비밀번호를", "확인해 주세요"],
    lead: [
      `${displayName}님, 요청하신 파트너 포털 임시 비밀번호입니다.`,
      "로그인 후 반드시 새 비밀번호로 변경해 주세요.",
    ],
    code: {
      label: "임시 비밀번호",
      value: getText(variables, "temporaryPassword", "-"),
      compact: true,
    },
    panels: [
      {
        tone: "info",
        title: "로그인 아이디",
        body: [getText(variables, "loginId", "-")],
      },
    ],
  });
}

function renderPartnerInitialSetup(variables: EmailVariables) {
  const displayName = getDisplayName(variables);
  return renderTransactionalEmail({
    preheader: "파트너 포털 초기 설정을 완료해 주세요.",
    kicker: "파트너 계정",
    title: ["포털 설정을", "완료해 주세요"],
    lead: [
      `${displayName}님, 파트너 포털 계정이 준비되었습니다.`,
      "아래 버튼을 눌러 새 비밀번호를 설정해 주세요.",
    ],
    panels: [
      {
        tone: "info",
        title: "로그인 아이디",
        body: [getText(variables, "loginId", "-")],
      },
    ],
    action: {
      label: "초기 설정하기",
      url: getActionUrl(variables, "setupUrl"),
    },
  });
}

function renderPartnerOperational(variables: EmailVariables) {
  const displayName = getDisplayName(variables);
  const body = getText(variables, "body", "알림 내용을 확인해 주세요.");
  return renderTransactionalEmail({
    preheader: getText(variables, "title", "파트너 운영 알림"),
    kicker: "운영 안내",
    title: getText(variables, "title", "파트너 운영 알림"),
    lead: [`${displayName}님, 확인이 필요한 운영 안내가 있습니다.`],
    panels: [
      {
        tone: "info",
        body: body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
      },
    ],
    action: {
      label: "알림 확인하기",
      url: getActionUrl(variables, "targetUrl"),
    },
  });
}

function renderPartnerExpiring(variables: EmailVariables) {
  const displayName = getDisplayName(variables);
  const partnerName = getText(variables, "partnerName", "제휴처");
  return renderTransactionalEmail({
    preheader: `${partnerName} 제휴 종료 일정을 확인해 주세요.`,
    kicker: "제휴 운영",
    title: ["제휴 종료 일정을", "확인해 주세요"],
    lead: [
      `${displayName}님, ${partnerName} 제휴의 종료일이 다가오고 있습니다.`,
    ],
    panels: [
      {
        tone: "warning",
        title: `${getText(variables, "daysUntilEnd", "-")}일 남음`,
        body: [
          `카테고리 · ${getText(variables, "partnerCategory", "-")}`,
          `위치 · ${getText(variables, "partnerLocation", "-")}`,
          `종료일 · ${getText(variables, "periodEnd", "-")}`,
        ],
      },
    ],
    action: {
      label: "제휴 정보 확인하기",
      url: getActionUrl(variables, "partnerUrl"),
    },
  });
}

function renderPartnerPlanChanged(variables: EmailVariables) {
  const displayName = getDisplayName(variables);
  const partnerName = getText(variables, "partnerName", "제휴처");
  const previousPlanName = getText(variables, "previousPlanName", "이전 플랜");
  const requestedPlanName = getFirstText(
    variables,
    ["requestedPlanName", "nextPlanName"],
    "변경 플랜",
  );
  const note = getText(variables, "note", "");
  return renderTransactionalEmail({
    preheader: `${partnerName}의 플랜 변경이 완료되었습니다.`,
    kicker: "플랜 변경",
    title: "플랜 변경이 완료되었습니다",
    titleSingleLine: true,
    lead: [`${displayName}님, ${partnerName}의 플랜이 변경되었습니다.`],
    panels: [
      {
        tone: "success",
        title: `${previousPlanName} → ${requestedPlanName}`,
        body: [
          `적용일 · ${getText(variables, "effectiveAt", "-")}`,
          `종료일 · ${getText(variables, "expiresAt", "-")}`,
          ...(note ? [`추가 안내 · ${note}`] : []),
        ],
      },
    ],
    action: {
      label: "변경된 플랜 확인하기",
      url: getActionUrl(variables, "planUrl"),
    },
  });
}

function renderPartnerPlanUpgradeRequested(variables: EmailVariables) {
  const displayName = getDisplayName(variables);
  const partnerName = getText(variables, "partnerName", "제휴처");
  const planName = getText(variables, "requestedPlanName", "요청 플랜");
  return renderTransactionalEmail({
    preheader: `${partnerName}의 플랜 업그레이드 요청을 접수했습니다.`,
    kicker: "플랜 업그레이드",
    title: ["업그레이드 요청을", "접수했습니다"],
    lead: [
      `${displayName}님, ${partnerName}의 ${planName} 플랜 업그레이드 요청을 접수했습니다.`,
    ],
    panels: [
      {
        tone: "info",
        title: planName,
        body: [
          `금액 · ${getText(variables, "amountKrw", "-")}`,
          `입금 기한 · ${getText(variables, "paymentDueAt", "-")}`,
        ],
      },
    ],
    action: {
      label: "요청 상태 확인하기",
      url: getActionUrl(variables, "planUrl"),
    },
  });
}

function renderPartnerPlanUpgradeApproved(variables: EmailVariables) {
  const displayName = getDisplayName(variables);
  const partnerName = getText(variables, "partnerName", "제휴처");
  const planName = getText(variables, "requestedPlanName", "요청 플랜");
  return renderTransactionalEmail({
    preheader: `${partnerName}의 플랜 업그레이드가 승인되었습니다.`,
    kicker: "플랜 업그레이드",
    title: ["업그레이드가", "승인되었습니다"],
    lead: [
      `${displayName}님, ${partnerName}의 ${planName} 플랜 업그레이드가 승인되었습니다.`,
    ],
    panels: [
      {
        tone: "success",
        title: "승인 완료",
        body: [
          `적용일 · ${getText(variables, "effectiveAt", "-")}`,
          `종료일 · ${getText(variables, "expiresAt", "-")}`,
        ],
      },
    ],
    action: {
      label: "변경된 플랜 확인하기",
      url: getActionUrl(variables, "planUrl"),
    },
  });
}

function renderPartnerPlanUpgradeRejected(variables: EmailVariables) {
  const displayName = getDisplayName(variables);
  const partnerName = getText(variables, "partnerName", "제휴처");
  const planName = getText(variables, "requestedPlanName", "요청 플랜");
  return renderTransactionalEmail({
    preheader: `${partnerName}의 플랜 업그레이드 결과를 확인해 주세요.`,
    kicker: "플랜 업그레이드",
    title: "업그레이드 요청이 반려되었습니다",
    titleSingleLine: true,
    lead: [
      `${displayName}님, ${partnerName}의 ${planName} 플랜 업그레이드 요청 검토가 완료되었습니다.`,
    ],
    panels: [
      {
        tone: "warning",
        title: "반려 사유",
        body: [getText(variables, "rejectionReason", "관리자에게 문의해 주세요.")],
      },
    ],
    action: {
      label: "요청 내용 확인하기",
      url: getActionUrl(variables, "planUrl"),
    },
  });
}

function renderPartnerMetricsDigest(variables: EmailVariables) {
  const displayName = getDisplayName(variables);
  const body = getText(variables, "body", "파트너 지표를 확인해 주세요.");
  return renderTransactionalEmail({
    preheader: getText(variables, "title", "파트너 지표 요약"),
    kicker: "지표 요약",
    title: "파트너 지표를 정리했습니다",
    titleSingleLine: true,
    lead: [`${displayName}님, 최근 파트너 운영 지표를 정리했습니다.`],
    panels: [
      {
        tone: "info",
        body: body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
      },
    ],
    action: {
      label: "상세 지표 확인하기",
      url: getActionUrl(variables, "targetUrl"),
    },
  });
}

export function renderDefaultNotificationEmailContent(
  eventKey: string,
  variables: EmailVariables,
): RenderedEmailBody | null {
  switch (eventKey as DefaultNotificationEmailEventKey) {
    case "email.member_email_verification_code":
      return renderMemberVerificationCode(variables);
    case "email.member_email_login_transition":
      return renderMemberEmailLoginTransition(variables);
    case "email.manual_member_setup":
      return renderManualMemberSetup(variables);
    case "email.manual_member_setup_reissue":
      return renderManualMemberSetupReissue(variables);
    case "email.manual_member_password_reset":
      return renderManualMemberPasswordReset(variables);
    case "email.partner_suggestion_received":
      return renderPartnerSuggestionReceived(variables);
    case "email.partner_temporary_password":
      return renderPartnerTemporaryPassword(variables);
    case "email.partner_initial_setup":
      return renderPartnerInitialSetup(variables);
    case "email.partner_operational":
      return renderPartnerOperational(variables);
    case "email.partner_operational.expiring_partner":
      return renderPartnerExpiring(variables);
    case "email.partner_operational.plan_changed":
      return renderPartnerPlanChanged(variables);
    case "email.partner_operational.plan_upgrade_requested":
      return renderPartnerPlanUpgradeRequested(variables);
    case "email.partner_operational.plan_upgrade_approved":
      return renderPartnerPlanUpgradeApproved(variables);
    case "email.partner_operational.plan_upgrade_rejected":
      return renderPartnerPlanUpgradeRejected(variables);
    case "email.partner_operational.metrics_digest":
      return renderPartnerMetricsDigest(variables);
    default:
      return null;
  }
}

export function renderResolvedNotificationEmailContent(
  input: ResolvedNotificationEmailContentInput,
) {
  if (!input.isCustomized) {
    const renderedDefault = renderDefaultNotificationEmailContent(
      input.eventKey,
      input.variables,
    );
    if (renderedDefault) {
      return renderedDefault;
    }
  }

  return renderEmailTemplateBody(
    input.bodyTemplate,
    input.bodyFormat,
    input.variables,
  );
}
