import type { NotificationTemplateContextKind } from "./context";

export const NOTIFICATION_TEMPLATE_CHANNELS = [
  "email",
  "mattermost",
  "push",
  "in_app",
] as const;

export type NotificationTemplateChannel =
  (typeof NOTIFICATION_TEMPLATE_CHANNELS)[number];

export const NOTIFICATION_TEMPLATE_BODY_FORMATS = [
  "plain",
  "markdown",
  "html",
] as const;

export type NotificationTemplateBodyFormat =
  (typeof NOTIFICATION_TEMPLATE_BODY_FORMATS)[number];

export type NotificationTemplateVariable = {
  name: string;
  label: string;
  description?: string;
  example?: string;
};

export type NotificationTemplateSource =
  | "manual"
  | "automatic"
  | "transactional"
  | "operational"
  | "compatibility";

export type NotificationTemplateAudience = "member" | "admin" | "partner" | "recipient";

export type NotificationTemplateDefinition = {
  eventKey: string;
  label: string;
  description: string;
  group: string;
  channel: NotificationTemplateChannel;
  titleTemplate: string;
  bodyTemplate: string;
  bodyFormat: NotificationTemplateBodyFormat;
  variables: readonly NotificationTemplateVariable[];
  requiredVariables: readonly string[];
  source: NotificationTemplateSource;
  audience: NotificationTemplateAudience;
  trigger: string;
  contextKey?: NotificationTemplateContextKind;
  isActive: boolean;
  legacy: boolean;
};

const siteName: NotificationTemplateVariable = {
  name: "siteName",
  label: "서비스 이름",
};
const displayName: NotificationTemplateVariable = {
  name: "displayName",
  label: "수신자 이름",
};
const code: NotificationTemplateVariable = {
  name: "code",
  label: "인증 코드",
};
const title: NotificationTemplateVariable = {
  name: "title",
  label: "알림 제목",
};
const body: NotificationTemplateVariable = {
  name: "body",
  label: "알림 내용",
};
const targetUrl: NotificationTemplateVariable = {
  name: "targetUrl",
  label: "이동 URL",
};

const semanticVariables = {
  partnerName: {
    name: "partnerName",
    label: "가게 이름",
    description: "알림 대상 제휴처의 공개 이름입니다.",
    example: "오늘의 식당",
  },
  partnerCategory: {
    name: "partnerCategory",
    label: "제휴 카테고리",
    description: "제휴처가 속한 공개 카테고리입니다.",
    example: "식음료",
  },
  partnerLocation: {
    name: "partnerLocation",
    label: "제휴처 위치",
    description: "제휴처의 공개 위치 또는 지점 정보입니다.",
    example: "서울 강남구 역삼동",
  },
  partnerUrl: {
    name: "partnerUrl",
    label: "제휴처 URL",
    description: "서비스 안의 제휴처 상세 페이지 주소입니다.",
    example: "/partners/example",
  },
  campusNames: {
    name: "campusNames",
    label: "대상 캠퍼스",
    description: "혜택이 적용되는 캠퍼스 이름 목록입니다.",
    example: "서울 캠퍼스, 구미 캠퍼스",
  },
  benefitSummary: {
    name: "benefitSummary",
    label: "혜택 요약",
    description: "회원에게 공개할 제휴 혜택 요약입니다.",
    example: "식사 메뉴 10% 할인",
  },
  conditions: {
    name: "conditions",
    label: "이용 조건",
    description: "제휴 혜택의 공개 이용 조건입니다.",
    example: "학생증 제시 시 적용",
  },
  periodStart: {
    name: "periodStart",
    label: "제휴 시작일",
    description: "제휴 혜택이 시작되는 날짜입니다.",
    example: "2026-07-01",
  },
  periodEnd: {
    name: "periodEnd",
    label: "제휴 종료일",
    description: "제휴 혜택이 종료되는 날짜입니다.",
    example: "2026-12-31",
  },
  mapUrl: {
    name: "mapUrl",
    label: "지도 URL",
    description: "제휴처 위치를 여는 공개 지도 주소입니다.",
    example: "https://map.example.com/place",
  },
  daysUntilEnd: {
    name: "daysUntilEnd",
    label: "종료까지 남은 일수",
    description: "제휴 종료일까지 남은 일수입니다.",
    example: "7",
  },
  companyName: {
    name: "companyName",
    label: "회사 이름",
    description: "파트너 회사의 공개 이름입니다.",
    example: "싸트너십 파트너스",
  },
  requesterName: {
    name: "requesterName",
    label: "요청자 이름",
    description: "변경 또는 플랜 요청을 제출한 담당자 이름입니다.",
    example: "홍길동",
  },
  changeSummary: {
    name: "changeSummary",
    label: "변경 요약",
    description: "운영자가 확인할 공개 변경 내용 요약입니다.",
    example: "혜택 문구와 운영 시간을 변경했습니다.",
  },
  requestUrl: {
    name: "requestUrl",
    label: "요청 확인 URL",
    description: "운영자가 요청을 확인할 내부 주소입니다.",
    example: "/admin/partner-requests",
  },
  currentPlanName: {
    name: "currentPlanName",
    label: "현재 플랜 이름",
    description: "변경 요청 전 플랜의 표시 이름입니다.",
    example: "Basic",
  },
  previousPlanName: {
    name: "previousPlanName",
    label: "이전 플랜 이름",
    description: "플랜 변경 전의 표시 이름입니다.",
    example: "Basic",
  },
  requestedPlanName: {
    name: "requestedPlanName",
    label: "요청 플랜 이름",
    description: "변경 요청 또는 승인된 플랜의 표시 이름입니다.",
    example: "Premium",
  },
  amountKrw: {
    name: "amountKrw",
    label: "금액(원)",
    description: "플랜 요청에 표시할 금액입니다.",
    example: "150,000원",
  },
  paymentDueAt: {
    name: "paymentDueAt",
    label: "입금 기한",
    description: "플랜 결제 또는 계좌이체 기한입니다.",
    example: "2026-07-24 18:00",
  },
  effectiveAt: {
    name: "effectiveAt",
    label: "적용 시작일",
    description: "변경된 플랜이 적용되는 시각 또는 날짜입니다.",
    example: "2026-07-18",
  },
  expiresAt: {
    name: "expiresAt",
    label: "적용 종료일",
    description: "변경된 플랜의 적용 종료일입니다.",
    example: "2026-08-17",
  },
  planUrl: {
    name: "planUrl",
    label: "플랜 관리 URL",
    description: "파트너가 플랜을 확인하는 포털 주소입니다.",
    example: "/partner/companies/example/plans",
  },
  rejectionReason: {
    name: "rejectionReason",
    label: "반려 사유",
    description: "플랜 요청을 반려한 운영자 안내입니다.",
    example: "입금 확인 자료가 부족합니다.",
  },
  updatedByName: {
    name: "updatedByName",
    label: "변경 수행자",
    description: "파트너 정보를 변경한 담당자 이름입니다.",
    example: "파트너 담당자",
  },
  targetLoginId: {
    name: "targetLoginId",
    label: "대상 로그인 ID",
    description: "권한 또는 상태가 변경된 관리자 계정의 로그인 ID입니다.",
    example: "admin@example.com",
  },
  actionName: {
    name: "actionName",
    label: "수행 작업",
    description: "권한 변경에 대해 수행한 작업 이름입니다.",
    example: "관리자 권한 부여",
  },
  permissionTemplateName: {
    name: "permissionTemplateName",
    label: "권한 템플릿",
    description: "적용된 관리자 권한 템플릿의 표시 이름입니다.",
    example: "운영 관리자",
  },
  managedCampusNames: {
    name: "managedCampusNames",
    label: "관리 캠퍼스",
    description: "권한이 관리하는 캠퍼스 이름 목록입니다.",
    example: "서울 캠퍼스",
  },
  adminUrl: {
    name: "adminUrl",
    label: "관리자 URL",
    description: "관리자가 작업 결과를 확인할 내부 주소입니다.",
    example: "/admin/admins",
  },
  statusName: {
    name: "statusName",
    label: "변경 상태",
    description: "관리자 권한의 새 상태 표시 이름입니다.",
    example: "활성화",
  },
  actorLoginId: {
    name: "actorLoginId",
    label: "수행 관리자 ID",
    description: "상태 또는 템플릿 변경을 수행한 관리자 ID입니다.",
    example: "superadmin",
  },
  note: {
    name: "note",
    label: "추가 안내",
    description: "플랜 변경에 함께 저장된 추가 안내입니다.",
    example: "7월 프로모션 적용",
  },
} satisfies Record<string, NotificationTemplateVariable>;

function defineTemplate(
  input: Omit<NotificationTemplateDefinition, "variables" | "requiredVariables" | "source" | "audience" | "trigger" | "isActive" | "legacy" | "bodyFormat"> & {
    variables: readonly NotificationTemplateVariable[];
    requiredVariables?: readonly string[];
    bodyFormat?: NotificationTemplateBodyFormat;
    source?: NotificationTemplateSource;
    audience?: NotificationTemplateAudience;
    trigger?: string;
    isActive?: boolean;
    legacy?: boolean;
  },
) {
  return {
    ...input,
    requiredVariables: input.requiredVariables ?? input.variables.map((item) => item.name),
    bodyFormat: input.bodyFormat ?? (input.channel === "email" ? "markdown" : "plain"),
    source: input.source ?? "transactional",
    audience: input.audience ?? "recipient",
    trigger: input.trigger ?? input.description,
    isActive: input.isActive ?? true,
    legacy: input.legacy ?? false,
  } satisfies NotificationTemplateDefinition;
}

const adminOperationalTypes = [
  ["partner_change_request", "파트너 변경 요청", "파트너 변경 요청이 접수되었을 때"],
  ["partner_immediate_update", "파트너 즉시 수정 반영", "파트너 정보가 즉시 수정되었을 때"],
  ["expiring_partner", "제휴 종료 임박", "제휴 종료가 임박했을 때"],
  ["security_alert", "보안 경고", "보안 관련 운영 알림이 발생했을 때"],
] as const;

const partnerOperationalTypes = [
  ["expiring_partner", "제휴 종료 임박", "파트너 제휴 종료가 임박했을 때"],
  ["plan_changed", "플랜 변경", "파트너 플랜이 변경되었을 때"],
  ["plan_upgrade_requested", "플랜 업그레이드 요청", "플랜 업그레이드 요청이 접수되었을 때"],
  ["plan_upgrade_approved", "플랜 업그레이드 승인", "플랜 업그레이드 요청이 승인되었을 때"],
  ["plan_upgrade_rejected", "플랜 업그레이드 반려", "플랜 업그레이드 요청이 반려되었을 때"],
  ["metrics_digest", "파트너 지표 요약", "파트너 지표 요약을 전송할 때"],
] as const;

const campaignTypes = [
  ["announcement", "운영 공지"],
  ["marketing", "마케팅/이벤트"],
  ["new_partner", "신규 제휴"],
  ["expiring_partner", "제휴 종료 임박"],
] as const;

const genericNotificationVariables = [title, body, targetUrl] as const;

type NotificationTemplateCopy = Pick<
  NotificationTemplateDefinition,
  "titleTemplate" | "bodyTemplate"
>;
type CampaignType = (typeof campaignTypes)[number][0];
type AdminOperationalType = (typeof adminOperationalTypes)[number][0];
type PartnerOperationalType = (typeof partnerOperationalTypes)[number][0];

const campaignTemplateCopies: Record<CampaignType, NotificationTemplateCopy> = {
  announcement: {
    titleTemplate: "운영 공지 · {title}",
    bodyTemplate: "{body}\n\n싸트너십 운영 공지에서 안내한 내용을 확인해 주세요.",
  },
  marketing: {
    titleTemplate: "마케팅·이벤트 · {title}",
    bodyTemplate: "{body}\n\n싸트너십 앱에서 이벤트 혜택을 확인해 보세요.",
  },
  new_partner: {
    titleTemplate: "새로운 제휴 혜택 · {title}",
    bodyTemplate: "{body}\n\n새 제휴처의 혜택을 확인해 보세요.",
  },
  expiring_partner: {
    titleTemplate: "제휴 종료 임박 · {title}",
    bodyTemplate: "{body}\n\n종료 전에 제휴 혜택을 확인해 보세요.",
  },
};

const adminOperationalTemplateCopies: Record<
  AdminOperationalType,
  NotificationTemplateCopy
> = {
  partner_change_request: {
    titleTemplate: "파트너 변경 요청 · {title}",
    bodyTemplate: "{body}\n\n관리자 페이지에서 변경 요청을 검토해 주세요.",
  },
  partner_immediate_update: {
    titleTemplate: "파트너 정보 즉시 수정 · {title}",
    bodyTemplate: "{body}\n\n관리자 페이지에서 반영 내용을 확인해 주세요.",
  },
  expiring_partner: {
    titleTemplate: "제휴 종료 임박 · {title}",
    bodyTemplate: "{body}\n\n관리자 페이지에서 제휴 기간을 확인해 주세요.",
  },
  security_alert: {
    titleTemplate: "보안 경고 · {title}",
    bodyTemplate: "{body}\n\n관리자 페이지에서 보안 상황을 확인해 주세요.",
  },
};

const partnerOperationalTemplateCopies: Record<
  PartnerOperationalType,
  NotificationTemplateCopy
> = {
  expiring_partner: {
    titleTemplate: "제휴 종료 임박 · {title}",
    bodyTemplate: "{body}\n\n파트너 포털에서 종료 일정을 확인해 주세요.",
  },
  plan_changed: {
    titleTemplate: "플랜 변경 안내 · {title}",
    bodyTemplate: "{body}\n\n파트너 포털에서 변경된 플랜을 확인해 주세요.",
  },
  plan_upgrade_requested: {
    titleTemplate: "플랜 업그레이드 요청 접수 · {title}",
    bodyTemplate: "{body}\n\n파트너 포털에서 요청 상태를 확인해 주세요.",
  },
  plan_upgrade_approved: {
    titleTemplate: "플랜 업그레이드 승인 · {title}",
    bodyTemplate: "{body}\n\n파트너 포털에서 변경된 플랜을 확인해 주세요.",
  },
  plan_upgrade_rejected: {
    titleTemplate: "플랜 업그레이드 반려 · {title}",
    bodyTemplate: "{body}\n\n파트너 포털에서 반려 사유와 다음 절차를 확인해 주세요.",
  },
  metrics_digest: {
    titleTemplate: "파트너 지표 요약 · {title}",
    bodyTemplate: "{body}\n\n파트너 포털에서 상세 지표를 확인해 주세요.",
  },
};

const emailTemplates: NotificationTemplateDefinition[] = [
  defineTemplate({
    eventKey: "email.member_email_verification_code",
    label: "회원 이메일 인증 코드",
    description: "이메일 로그인 등록·변경 시 전송하는 인증 코드 이메일입니다.",
    group: "회원·수료생 이메일",
    channel: "email",
    titleTemplate: "[{siteName}] 이메일 인증 코드",
    bodyTemplate:
      "이메일 로그인 등록 또는 변경을 위한 인증 코드입니다.\n\n인증 코드: {code}\n\n코드는 {expiresInMinutes}분 동안 사용할 수 있습니다. 본인이 요청하지 않았다면 이 메일을 무시해 주세요.",
    variables: [siteName, code, { name: "expiresInMinutes", label: "코드 유효 시간(분)" }],
  }),
  defineTemplate({
    eventKey: "email.graduate_application_code",
    label: "수료생 신규 인증 코드",
    description: "수료생 신규 인증 이메일의 인증 코드입니다.",
    group: "회원·수료생 이메일",
    channel: "email",
    titleTemplate: "[{siteName}] 수료생 인증 코드",
    bodyTemplate: "수료생 가입을 위한 이메일 인증 코드입니다.\n\n인증 코드: {code}\n\n{expirationNotice}",
    variables: [siteName, code, { name: "expirationNotice", label: "만료 안내" }],
  }),
  defineTemplate({
    eventKey: "email.graduate_password_reset_code",
    label: "수료생 비밀번호 재설정 코드",
    description: "수료생 비밀번호 재설정 이메일의 인증 코드입니다.",
    group: "회원·수료생 이메일",
    channel: "email",
    titleTemplate: "[{siteName}] 수료생 비밀번호 재설정 코드",
    bodyTemplate: "수료생 계정의 비밀번호 재설정을 위한 이메일 인증 코드입니다.\n\n인증 코드: {code}\n\n{expirationNotice}",
    variables: [siteName, code, { name: "expirationNotice", label: "만료 안내" }],
  }),
  defineTemplate({
    eventKey: "email.graduate_account_setup",
    label: "수료생 계정 초기 설정",
    description: "수료생 인증 승인 후 비밀번호 설정 링크를 전송합니다.",
    group: "회원·수료생 이메일",
    channel: "email",
    titleTemplate: "[{siteName}] {subjectLabel}",
    bodyTemplate: "{description}\n\n아래 링크에서 비밀번호를 설정해 주세요.\n{setupUrl}\n\n링크는 24시간 동안 한 번만 사용할 수 있습니다.",
    variables: [siteName, { name: "subjectLabel", label: "메일 제목 보조 문구" }, { name: "description", label: "설명" }, { name: "setupUrl", label: "설정 URL" }],
  }),
  defineTemplate({
    eventKey: "email.graduate_password_reset",
    label: "수료생 비밀번호 재설정",
    description: "수료생 비밀번호 재설정 링크를 전송합니다.",
    group: "회원·수료생 이메일",
    channel: "email",
    titleTemplate: "[{siteName}] 수료생 비밀번호 재설정",
    bodyTemplate: "{displayName}님, 비밀번호 재설정 요청을 확인했습니다.\n\n아래 링크에서 새 비밀번호를 설정해 주세요.\n{setupUrl}\n\n링크는 24시간 동안 한 번만 사용할 수 있습니다. 본인이 요청하지 않았다면 이 메일을 무시해 주세요.",
    variables: [siteName, displayName, { name: "setupUrl", label: "설정 URL" }],
  }),
  defineTemplate({
    eventKey: "email.graduate_resubmission",
    label: "수료생 인증 보완 요청",
    description: "관리자가 보완을 요청했을 때 전송하는 이메일입니다.",
    group: "회원·수료생 이메일",
    channel: "email",
    titleTemplate: "[{siteName}] 수료생 인증 보완 요청",
    bodyTemplate: "{displayName}님, 수료생 인증 신청에 보완이 필요합니다.\n보완 항목: {targets}\n{note}\n\n아래 페이지에서 같은 이메일로 다시 인증한 뒤 보완 요청된 항목만 제출해 주세요.\n{applicationUrl}",
    variables: [siteName, displayName, { name: "targets", label: "보완 항목" }, { name: "note", label: "관리자 안내" }, { name: "applicationUrl", label: "보완 제출 URL" }],
  }),
  defineTemplate({
    eventKey: "email.graduate_rejection",
    label: "수료생 인증 반려",
    description: "관리자가 수료생 인증 신청을 반려했을 때 전송하는 이메일입니다.",
    group: "회원·수료생 이메일",
    channel: "email",
    titleTemplate: "[{siteName}] 수료생 인증 신청 반려",
    bodyTemplate: "{displayName}님, 수료생 인증 신청이 반려되었습니다.\n반려 사유: {reason}\n\n내용을 확인한 뒤 아래 페이지에서 다시 신청해 주세요.\n{applicationUrl}",
    variables: [siteName, displayName, { name: "reason", label: "반려 사유" }, { name: "applicationUrl", label: "재신청 URL" }],
  }),
  defineTemplate({
    eventKey: "email.member_email_login_transition",
    label: "회원 이메일 로그인 전환",
    description: "Mattermost 로그인 전환이 필요한 회원에게 이메일 설정 링크를 전송합니다.",
    group: "회원·수료생 이메일",
    channel: "email",
    titleTemplate: "[{siteName}] 이메일 로그인 설정",
    bodyTemplate: "{displayName}님, Mattermost 로그인을 이메일 로그인으로 전환합니다.\n\n아래 링크에서 이메일 로그인용 비밀번호를 설정해 주세요.\n{setupUrl}\n\n링크는 24시간 동안 한 번만 사용할 수 있습니다.",
    variables: [siteName, displayName, { name: "setupUrl", label: "설정 URL" }],
  }),
  defineTemplate({
    eventKey: "email.manual_member_setup",
    label: "수동 추가 회원 초기 설정",
    description: "관리자가 수동으로 추가하거나 가져온 회원에게 비밀번호 설정 링크를 전송합니다.",
    group: "회원·수료생 이메일",
    channel: "email",
    titleTemplate: "[{siteName}] 계정 비밀번호 설정",
    bodyTemplate: "{displayName}님, 아래 링크에서 {siteName} 비밀번호를 설정해 주세요.\n\n{setupUrl}\n\n링크는 24시간 동안 한 번만 사용할 수 있습니다.",
    variables: [siteName, displayName, { name: "setupUrl", label: "설정 URL" }],
  }),
  defineTemplate({
    eventKey: "email.manual_member_password_reset",
    label: "수동 추가 회원 비밀번호 재설정",
    description: "수동 추가 회원의 비밀번호 재설정 링크를 전송합니다.",
    group: "회원·수료생 이메일",
    channel: "email",
    titleTemplate: "[{siteName}] 비밀번호 재설정",
    bodyTemplate: "{displayName}님, 아래 링크에서 {siteName} 비밀번호를 재설정해 주세요.\n\n{setupUrl}\n\n링크는 24시간 동안 한 번만 사용할 수 있습니다.",
    variables: [siteName, displayName, { name: "setupUrl", label: "설정 URL" }],
  }),
  defineTemplate({
    eventKey: "email.partner_suggestion_received",
    label: "제휴 제안 접수 안내",
    description: "제휴 제안을 접수한 제안자와 운영 수신처에 전송하는 안내 메일입니다.",
    group: "제휴 이메일",
    channel: "email",
    titleTemplate: "[{siteName}] 제휴 제안 접수 안내",
    bodyTemplate: "안녕하세요 {contactName} {contactRole}님,\n\n{siteName} 파트너십 제안을 접수했습니다. 보내주신 내용을 아래와 같이 정리해 전달드립니다.\n\n파트너사명: {companyName}\n사업 분야 소개: {businessArea}\n제안 제휴 조건: {partnershipConditions}\n담당자 이메일: {contactEmail}\n회사 사이트: {companyUrl}\n\n담당자가 확인 후 안내드리겠습니다. 추가로 전달하실 내용이 있으면 이 메일에 회신해 주세요.",
    variables: [
      siteName,
      { name: "contactName", label: "담당자 이름" },
      { name: "contactRole", label: "담당자 직위" },
      { name: "companyName", label: "파트너사명" },
      { name: "businessArea", label: "사업 분야" },
      { name: "partnershipConditions", label: "제휴 조건" },
      { name: "contactEmail", label: "담당자 이메일" },
      { name: "companyUrl", label: "회사 사이트" },
    ],
  }),
  defineTemplate({
    eventKey: "email.partner_temporary_password",
    label: "파트너 포털 임시 비밀번호",
    description: "파트너 포털 임시 비밀번호를 안내하는 이메일입니다.",
    group: "파트너 이메일",
    channel: "email",
    titleTemplate: "[{siteName}] 파트너사 포털 임시 비밀번호 안내",
    bodyTemplate: "{displayName}님, 요청하신 파트너사 포털 임시 비밀번호입니다.\n로그인 아이디: {loginId}\n임시 비밀번호: {temporaryPassword}\n\n로그인 후 반드시 새 비밀번호로 변경해 주세요.",
    variables: [siteName, displayName, { name: "loginId", label: "로그인 아이디" }, { name: "temporaryPassword", label: "임시 비밀번호" }],
  }),
  defineTemplate({
    eventKey: "email.partner_initial_setup",
    label: "파트너 포털 초기 설정",
    description: "파트너 계정의 초기 비밀번호 설정 링크를 전송합니다.",
    group: "파트너 이메일",
    channel: "email",
    titleTemplate: "[{siteName}] 파트너사 포털 초기 설정 안내",
    bodyTemplate: "{displayName}님, 파트너사 포털 초기 설정 링크를 전송드립니다.\n로그인 아이디: {loginId}\n초기 설정 URL: {setupUrl}\n\n링크로 이동해 새 비밀번호를 설정해 주세요.",
    variables: [siteName, displayName, { name: "loginId", label: "로그인 아이디" }, { name: "setupUrl", label: "초기 설정 URL" }],
  }),
  defineTemplate({
    eventKey: "email.partner_operational",
    label: "파트너 운영 알림 이메일",
    description: "파트너 플랜·제휴 운영 알림을 이메일로 전송합니다.",
    group: "파트너 이메일",
    channel: "email",
    titleTemplate: "[{siteName}] {title}",
    bodyTemplate: "{displayName}님,\n\n{body}\n\n알림 확인: {targetUrl}",
    variables: [siteName, displayName, title, body, targetUrl],
  }),
];

const mattermostTemplates: NotificationTemplateDefinition[] = [
  defineTemplate({
    eventKey: "mattermost.signup_code",
    label: "Mattermost 회원가입 인증 코드",
    description: "회원가입 시 Mattermost DM으로 전송하는 6자리 코드입니다.",
    group: "Mattermost",
    channel: "mattermost",
    titleTemplate: "[싸트너십] {title}",
    bodyTemplate: "인증 코드: `{code}`\n코드는 5분 동안 한 번만 사용할 수 있습니다.\n본인이 요청하지 않았다면 이 메시지를 무시해 주세요.",
    variables: [title, code],
  }),
  defineTemplate({
    eventKey: "mattermost.reset_password_code",
    label: "Mattermost 비밀번호 재설정 코드",
    description: "비밀번호 재설정 시 Mattermost DM으로 전송하는 6자리 코드입니다.",
    group: "Mattermost",
    channel: "mattermost",
    titleTemplate: "[싸트너십] {title}",
    bodyTemplate: "인증 코드: `{code}`\n코드는 5분 동안 한 번만 사용할 수 있습니다.\n본인이 요청하지 않았다면 이 메시지를 무시해 주세요.",
    variables: [title, code],
  }),
  defineTemplate({
    eventKey: "mattermost.manual_member_temporary_password",
    label: "수동 추가 회원 임시 비밀번호",
    description: "관리자가 수동으로 추가한 회원에게 Mattermost DM으로 전송하는 임시 비밀번호입니다.",
    group: "Mattermost",
    channel: "mattermost",
    titleTemplate: "[{siteName}] 임시 비밀번호",
    bodyTemplate: "{displayName}님, {siteName} 임시 비밀번호입니다.\n\n임시 비밀번호\n```plaintext\n{temporaryPassword}\n```\n\n보안을 위해 로그인 후 반드시 변경해 주세요.",
    variables: [siteName, displayName, { name: "temporaryPassword", label: "임시 비밀번호" }],
  }),
  defineTemplate({
    eventKey: "mattermost.manual_member_setup",
    label: "수동 추가 회원 계정 설정",
    description: "수동으로 추가하거나 가져온 회원에게 Mattermost DM으로 비밀번호 설정 링크를 전송합니다.",
    group: "Mattermost",
    channel: "mattermost",
    titleTemplate: "[{siteName}] 계정 설정",
    bodyTemplate: "{displayName}님, 아래 링크에서 {siteName} 비밀번호를 설정해 주세요.\n{setupUrl}\n\n링크는 24시간 동안 한 번만 사용할 수 있습니다.",
    variables: [siteName, displayName, { name: "setupUrl", label: "설정 URL" }],
  }),
  defineTemplate({
    eventKey: "mattermost.sender_test",
    label: "Mattermost Sender 연결 테스트",
    description: "운영자가 Sender 계정을 활성화하기 전에 테스트 대상에게 전송하는 DM입니다.",
    group: "Mattermost",
    channel: "mattermost",
    titleTemplate: "[{siteName}] Mattermost Sender 연결 테스트",
    bodyTemplate: "이 메시지가 보이면 {siteName} Mattermost Sender 연결 테스트에 성공한 것입니다.",
    variables: [siteName],
  }),
];

const campaignTemplates = campaignTypes.flatMap(([type, label]) => {
  const copy = campaignTemplateCopies[type];
  return [
    defineTemplate({
      eventKey: `mattermost.admin_campaign.${type}`,
      label: `${label} Mattermost 메시지`,
      description: "관리자가 직접 작성하는 캠페인 Mattermost 메시지입니다.",
      group: "수동 운영 캠페인",
      channel: "mattermost",
      titleTemplate: "### [싸트너십/{categoryLabel}] {title}",
      bodyTemplate: "{body}{targetLink}",
      variables: [
        { name: "categoryLabel", label: "분류 라벨" },
        title,
        body,
        { name: "targetLink", label: "바로가기 Markdown" },
      ],
      requiredVariables: ["categoryLabel", "title", "body"],
      source: "manual",
      audience: "member",
      trigger: "관리자가 캠페인 발송을 실행했을 때",
    }),
    defineTemplate({
      eventKey: `push.admin_campaign.${type}`,
      label: `${label} 푸시 알림`,
      description: `${label} 캠페인에서 관리자가 직접 작성하는 회원 대상 푸시 알림입니다.`,
      group: "수동 운영 캠페인",
      channel: "push",
      ...copy,
      variables: genericNotificationVariables,
      requiredVariables: ["title", "body"],
      source: "manual",
      audience: "member",
      trigger: "관리자가 캠페인 발송을 실행했을 때",
    }),
    defineTemplate({
      eventKey: `in_app.admin_campaign.${type}`,
      label: `${label} 인앱 알림`,
      description: `${label} 캠페인에서 회원 알림센터에 저장되는 관리자 작성 문구입니다.`,
      group: "수동 운영 캠페인",
      channel: "in_app",
      ...copy,
      variables: genericNotificationVariables,
      requiredVariables: ["title", "body"],
      source: "manual",
      audience: "member",
      trigger: "관리자가 캠페인 발송을 실행했을 때",
    }),
  ];
});

const automaticCampaignContexts = {
  new_partner: {
    label: "자동 신규 제휴",
    contextKey: "new_partner" as const,
    variables: [
      semanticVariables.partnerName,
      semanticVariables.partnerCategory,
      semanticVariables.partnerLocation,
      semanticVariables.partnerUrl,
      semanticVariables.campusNames,
      semanticVariables.benefitSummary,
      semanticVariables.conditions,
      semanticVariables.periodStart,
      semanticVariables.periodEnd,
      semanticVariables.mapUrl,
    ],
    requiredVariables: ["partnerName", "partnerCategory", "partnerLocation", "partnerUrl", "benefitSummary"],
    titleTemplate: "새로운 제휴 혜택 · {partnerName}",
    bodyTemplate:
      "가게명: {partnerName}\n카테고리: {partnerCategory}\n위치: {partnerLocation}\n대상 캠퍼스: {campusNames}\n혜택: {benefitSummary}\n이용 조건: {conditions}\n제휴 기간: {periodStart} ~ {periodEnd}\n\n{partnerUrl}",
  },
  expiring_partner: {
    label: "자동 제휴 종료 임박",
    contextKey: "expiring_partner" as const,
    variables: [
      semanticVariables.partnerName,
      semanticVariables.partnerCategory,
      semanticVariables.partnerLocation,
      semanticVariables.periodEnd,
      semanticVariables.daysUntilEnd,
      semanticVariables.partnerUrl,
    ],
    requiredVariables: ["partnerName", "partnerCategory", "partnerLocation", "periodEnd", "daysUntilEnd", "partnerUrl"],
    titleTemplate: "제휴 종료 임박 · {partnerName}",
    bodyTemplate:
      "{partnerName} 제휴가 {periodEnd}에 종료됩니다.\n카테고리: {partnerCategory}\n위치: {partnerLocation}\n남은 기간: {daysUntilEnd}일\n\n{partnerUrl}",
  },
} as const;

const automaticCampaignTemplates = (["new_partner", "expiring_partner"] as const).flatMap((type) => {
  const context = automaticCampaignContexts[type];
  return (["mattermost", "push", "in_app"] as const).map((channel) =>
    defineTemplate({
      eventKey: `${channel}.automatic_campaign.${type}`,
      label: `${context.label} ${channel === "mattermost" ? "Mattermost" : channel === "push" ? "푸시" : "인앱"}`,
      description: `${type === "new_partner" ? "신규 제휴가 공개되었을 때" : "제휴 종료일이 가까워졌을 때"} 저장된 제휴 데이터로 자동 발송합니다.`,
      group: "자동 운영 캠페인",
      channel,
      titleTemplate: context.titleTemplate,
      bodyTemplate: channel === "mattermost"
        ? `${context.bodyTemplate}\n\n{targetLink}`
        : context.bodyTemplate,
      variables: channel === "mattermost"
        ? [...context.variables, { name: "targetLink", label: "바로가기 Markdown" }]
        : context.variables,
      requiredVariables: context.requiredVariables,
      source: "automatic",
      audience: "member",
      trigger: type === "new_partner" ? "공개 제휴처가 등록·승인되거나 시작 전·비공개에서 공개로 전환되었을 때" : "제휴 종료 예정일에 도달했을 때",
      contextKey: context.contextKey,
    }),
  );
});

const adminOperationalSemanticContexts = {
  partner_change_request: {
    label: "파트너 변경 요청",
    description: "파트너 담당자가 변경 요청을 제출했을 때 관리자에게 전송합니다.",
    contextKey: "admin_partner_change_request" as const,
    variables: [semanticVariables.companyName, semanticVariables.partnerName, semanticVariables.requesterName, semanticVariables.changeSummary, semanticVariables.requestUrl],
    requiredVariables: ["companyName", "partnerName", "requesterName", "changeSummary", "requestUrl"],
    titleTemplate: "파트너 변경 요청 · {partnerName}",
    bodyTemplate: "회사: {companyName}\n제휴처: {partnerName}\n요청자: {requesterName}\n변경 내용: {changeSummary}\n\n{requestUrl}",
  },
  partner_plan_upgrade_request: {
    label: "파트너 플랜 업그레이드 요청",
    description: "파트너 플랜 업그레이드 요청이 접수되었을 때 관리자에게 전송합니다.",
    contextKey: "admin_partner_plan_upgrade_request" as const,
    variables: [semanticVariables.companyName, semanticVariables.partnerName, semanticVariables.requesterName, semanticVariables.currentPlanName, semanticVariables.requestedPlanName, semanticVariables.amountKrw, semanticVariables.requestUrl],
    requiredVariables: ["companyName", "partnerName", "requesterName", "currentPlanName", "requestedPlanName", "amountKrw", "requestUrl"],
    titleTemplate: "플랜 업그레이드 요청 · {partnerName}",
    bodyTemplate: "회사: {companyName}\n제휴처: {partnerName}\n요청자: {requesterName}\n플랜: {currentPlanName} → {requestedPlanName}\n금액: {amountKrw}\n\n{requestUrl}",
  },
  partner_immediate_update: {
    label: "파트너 즉시 수정 반영",
    description: "파트너가 기본 정보를 즉시 수정했을 때 관리자에게 전송합니다.",
    contextKey: "admin_partner_immediate_update" as const,
    variables: [semanticVariables.companyName, semanticVariables.partnerName, semanticVariables.changeSummary, semanticVariables.updatedByName, semanticVariables.partnerUrl],
    requiredVariables: ["companyName", "partnerName", "changeSummary", "updatedByName", "partnerUrl"],
    titleTemplate: "파트너 정보 즉시 수정 · {partnerName}",
    bodyTemplate: "회사: {companyName}\n변경 제휴처: {partnerName}\n변경 내용: {changeSummary}\n수정자: {updatedByName}\n\n{partnerUrl}",
  },
  expiring_partner: {
    label: "관리자용 제휴 종료 임박",
    description: "제휴 종료일이 가까워졌을 때 관리자에게 전송합니다.",
    contextKey: "admin_expiring_partner" as const,
    variables: [semanticVariables.partnerName, semanticVariables.partnerCategory, semanticVariables.partnerLocation, semanticVariables.periodEnd, semanticVariables.daysUntilEnd, semanticVariables.adminUrl],
    requiredVariables: ["partnerName", "partnerCategory", "partnerLocation", "periodEnd", "daysUntilEnd", "adminUrl"],
    titleTemplate: "제휴 종료 임박 · {partnerName}",
    bodyTemplate: "제휴처: {partnerName}\n카테고리: {partnerCategory}\n위치: {partnerLocation}\n종료일: {periodEnd}\n남은 기간: {daysUntilEnd}일\n\n{adminUrl}",
  },
  security_permission_granted: {
    label: "보안 권한 부여",
    description: "관리자 권한이 새로 부여되었을 때 관리자에게 전송합니다.",
    contextKey: "admin_security_permission_granted" as const,
    variables: [semanticVariables.targetLoginId, semanticVariables.actionName, semanticVariables.permissionTemplateName, semanticVariables.managedCampusNames, semanticVariables.adminUrl],
    requiredVariables: ["targetLoginId", "actionName", "permissionTemplateName", "managedCampusNames", "adminUrl"],
    titleTemplate: "보안 권한 부여 · {targetLoginId}",
    bodyTemplate: "대상 계정: {targetLoginId}\n수행 작업: {actionName}\n권한 템플릿: {permissionTemplateName}\n관리 캠퍼스: {managedCampusNames}\n\n{adminUrl}",
  },
  security_status_changed: {
    label: "보안 상태 변경",
    description: "관리자 계정의 활성화 상태가 변경되었을 때 전송합니다.",
    contextKey: "admin_security_status_changed" as const,
    variables: [semanticVariables.targetLoginId, semanticVariables.statusName, semanticVariables.actorLoginId, semanticVariables.adminUrl],
    requiredVariables: ["targetLoginId", "statusName", "actorLoginId", "adminUrl"],
    titleTemplate: "보안 상태 변경 · {targetLoginId}",
    bodyTemplate: "대상 계정: {targetLoginId}\n변경 상태: {statusName}\n수행 관리자: {actorLoginId}\n\n{adminUrl}",
  },
  security_template_changed: {
    label: "보안 템플릿 변경",
    description: "관리자 권한 템플릿이 변경되었을 때 전송합니다.",
    contextKey: "admin_security_template_changed" as const,
    variables: [semanticVariables.targetLoginId, semanticVariables.permissionTemplateName, semanticVariables.actorLoginId, semanticVariables.managedCampusNames, semanticVariables.adminUrl],
    requiredVariables: ["targetLoginId", "permissionTemplateName", "actorLoginId", "managedCampusNames", "adminUrl"],
    titleTemplate: "보안 템플릿 변경 · {targetLoginId}",
    bodyTemplate: "대상 계정: {targetLoginId}\n권한 템플릿: {permissionTemplateName}\n관리 캠퍼스: {managedCampusNames}\n수행 관리자: {actorLoginId}\n\n{adminUrl}",
  },
} as const;

const adminOperationalTemplates = Object.entries(adminOperationalSemanticContexts).flatMap(([type, context]) =>
  (["push", "in_app"] as const).map((channel) =>
    defineTemplate({
      eventKey: `${channel}.admin_operational.${type}`,
      label: `${context.label} ${channel === "push" ? "푸시" : "인앱"}`,
      description: context.description,
      group: "관리자 운영 알림",
      channel,
      titleTemplate: context.titleTemplate,
      bodyTemplate: context.bodyTemplate,
      variables: context.variables,
      requiredVariables: context.requiredVariables,
      source: "operational",
      audience: "admin",
      trigger: context.description,
      contextKey: context.contextKey,
    }),
  ),
);

const legacyAdminOperationalTemplates = adminOperationalTypes.filter(([type]) => type === "security_alert").flatMap(([type, label, description]) =>
  (["push", "in_app"] as const).map((channel) =>
    defineTemplate({
      eventKey: `${channel}.admin_operational.${type}`,
      label: `${label} ${channel === "push" ? "푸시" : "인앱"} 호환용`,
      description: `${description} 기존 사용자 지정 문구를 보존하는 호환용 템플릿입니다.`,
      group: "호환·비활성 템플릿",
      channel,
      ...adminOperationalTemplateCopies[type],
      variables: genericNotificationVariables,
      requiredVariables: ["title", "body"],
      source: "compatibility",
      audience: "admin",
      trigger: "기존 호환 발송 경로",
      isActive: false,
      legacy: true,
    }),
  ),
);

const partnerOperationalContexts = {
  expiring_partner: {
    contextKey: "partner_expiring_partner" as const,
    variables: [semanticVariables.partnerName, semanticVariables.partnerCategory, semanticVariables.partnerLocation, semanticVariables.periodEnd, semanticVariables.daysUntilEnd, semanticVariables.partnerUrl],
    requiredVariables: ["partnerName", "partnerCategory", "partnerLocation", "periodEnd", "daysUntilEnd", "partnerUrl"],
    titleTemplate: "제휴 종료 임박 · {partnerName}",
    bodyTemplate: "{partnerName} 제휴가 {periodEnd}에 종료됩니다.\n카테고리: {partnerCategory}\n위치: {partnerLocation}\n남은 기간: {daysUntilEnd}일\n\n{partnerUrl}",
  },
  plan_changed: {
    contextKey: "partner_plan_changed" as const,
    variables: [semanticVariables.partnerName, semanticVariables.previousPlanName, semanticVariables.requestedPlanName, semanticVariables.effectiveAt, semanticVariables.expiresAt, semanticVariables.planUrl, semanticVariables.note],
    requiredVariables: ["partnerName", "previousPlanName", "requestedPlanName", "effectiveAt", "expiresAt", "planUrl"],
    titleTemplate: "플랜 변경 안내 · {partnerName}",
    bodyTemplate: "{partnerName}의 플랜이 {previousPlanName}에서 {requestedPlanName}(으)로 변경되었습니다.\n적용 기간: {effectiveAt} ~ {expiresAt}\n추가 안내: {note}\n\n{planUrl}",
  },
  plan_upgrade_requested: {
    contextKey: "partner_plan_upgrade_requested" as const,
    variables: [semanticVariables.partnerName, semanticVariables.requestedPlanName, semanticVariables.amountKrw, semanticVariables.paymentDueAt, semanticVariables.planUrl],
    requiredVariables: ["partnerName", "requestedPlanName", "amountKrw", "paymentDueAt", "planUrl"],
    titleTemplate: "플랜 업그레이드 요청 접수 · {partnerName}",
    bodyTemplate: "{partnerName}의 {requestedPlanName} 업그레이드 요청이 접수되었습니다.\n금액: {amountKrw}\n입금 기한: {paymentDueAt}\n\n{planUrl}",
  },
  plan_upgrade_approved: {
    contextKey: "partner_plan_upgrade_approved" as const,
    variables: [semanticVariables.partnerName, semanticVariables.requestedPlanName, semanticVariables.effectiveAt, semanticVariables.expiresAt, semanticVariables.planUrl],
    requiredVariables: ["partnerName", "requestedPlanName", "effectiveAt", "expiresAt", "planUrl"],
    titleTemplate: "플랜 업그레이드 승인 · {partnerName}",
    bodyTemplate: "{partnerName}의 {requestedPlanName} 플랜 업그레이드가 승인되었습니다.\n적용 기간: {effectiveAt} ~ {expiresAt}\n\n{planUrl}",
  },
  plan_upgrade_rejected: {
    contextKey: "partner_plan_upgrade_rejected" as const,
    variables: [semanticVariables.partnerName, semanticVariables.requestedPlanName, semanticVariables.rejectionReason, semanticVariables.planUrl],
    requiredVariables: ["partnerName", "requestedPlanName", "rejectionReason", "planUrl"],
    titleTemplate: "플랜 업그레이드 반려 · {partnerName}",
    bodyTemplate: "{partnerName}의 {requestedPlanName} 플랜 업그레이드 요청이 반려되었습니다.\n반려 사유: {rejectionReason}\n\n{planUrl}",
  },
} as const;

const partnerOperationalTemplates = partnerOperationalTypes.flatMap(([type, label, description]) => {
  const context = partnerOperationalContexts[type as keyof typeof partnerOperationalContexts];
  if (!context) {
    return (["push", "in_app"] as const).map((channel) =>
      defineTemplate({
        eventKey: `${channel}.partner_operational.${type}`,
        label: `파트너 ${label} ${channel === "push" ? "푸시" : "인앱"} 호환용`,
        description: `${description} 현재 발송 경로가 없어 다음 기능 추가 시 컨텍스트를 등록합니다.`,
        group: "호환·비활성 템플릿",
        channel,
        ...partnerOperationalTemplateCopies[type],
        variables: genericNotificationVariables,
        requiredVariables: ["title", "body"],
        source: "compatibility",
        audience: "partner",
        trigger: "현재 발송 경로 없음",
        isActive: false,
        legacy: true,
      }),
    ).concat(
      defineTemplate({
        eventKey: `email.partner_operational.${type}`,
        label: `파트너 ${label} 이메일 호환용`,
        description: `${description} 현재 발송 경로가 없어 다음 기능 추가 시 컨텍스트를 등록합니다.`,
        group: "호환·비활성 템플릿",
        channel: "email",
        titleTemplate: "[{siteName}] {title}",
        bodyTemplate: "{displayName}님,\n\n{body}\n\n알림 확인: {targetUrl}",
        variables: [siteName, displayName, title, body, targetUrl],
        requiredVariables: ["siteName", "displayName", "title", "body", "targetUrl"],
        source: "compatibility",
        audience: "partner",
        trigger: "현재 발송 경로 없음",
        isActive: false,
        legacy: true,
      }),
    );
  }
  return [
    ...(["push", "in_app"] as const).map((channel) =>
      defineTemplate({
        eventKey: `${channel}.partner_operational.${type}`,
        label: `파트너 ${label} ${channel === "push" ? "푸시" : "인앱"}`,
        description,
        group: "파트너 운영 알림",
        channel,
        titleTemplate: context.titleTemplate,
        bodyTemplate: context.bodyTemplate,
        variables: context.variables,
        requiredVariables: context.requiredVariables,
        source: "operational",
        audience: "partner",
        trigger: description,
        contextKey: context.contextKey,
      }),
    ),
    defineTemplate({
      eventKey: `email.partner_operational.${type}`,
      label: `파트너 ${label} 이메일`,
      description,
      group: "파트너 운영 알림",
      channel: "email",
      titleTemplate: "[{siteName}] {partnerName}",
      bodyTemplate: `{displayName}님,\n\n${context.bodyTemplate}`,
      variables: [siteName, displayName, ...context.variables],
      requiredVariables: ["siteName", "displayName", ...context.requiredVariables],
      source: "operational",
      audience: "partner",
      trigger: description,
      contextKey: context.contextKey,
    }),
  ];
});

export const NOTIFICATION_TEMPLATE_CATALOG = [
  ...emailTemplates,
  ...mattermostTemplates,
  ...campaignTemplates,
  ...automaticCampaignTemplates,
  ...adminOperationalTemplates,
  ...legacyAdminOperationalTemplates,
  ...partnerOperationalTemplates,
] as const satisfies readonly NotificationTemplateDefinition[];

const definitionByEventKey = new Map(
  NOTIFICATION_TEMPLATE_CATALOG.map((definition) => [definition.eventKey, definition]),
);

export function getNotificationTemplateDefinition(eventKey: string) {
  return definitionByEventKey.get(eventKey) ?? null;
}

export function getNotificationTemplateDefinitionsByGroup() {
  const groups = new Map<string, NotificationTemplateDefinition[]>();
  for (const definition of NOTIFICATION_TEMPLATE_CATALOG) {
    const entries = groups.get(definition.group) ?? [];
    entries.push(definition);
    groups.set(definition.group, entries);
  }
  return [...groups.entries()].map(([group, definitions]) => ({ group, definitions }));
}

export function getAdminOperationalTemplateKey(
  channel: "push" | "in_app",
  type: string,
  variant?: string,
) {
  return `${channel}.admin_operational.${variant ?? type}`;
}

export function getPartnerOperationalTemplateKey(
  channel: "email" | "push" | "in_app",
  type: string,
  variant?: string,
) {
  return `${channel}.partner_operational.${variant ?? type}`;
}

export function getCampaignTemplateKey(
  channel: "email" | "mattermost" | "push" | "in_app",
  type: string,
  source: "manual" | "automatic" = "manual",
) {
  const group = source === "automatic" && (type === "new_partner" || type === "expiring_partner")
    ? "automatic_campaign"
    : "admin_campaign";
  return `${channel}.${group}.${type}`;
}
