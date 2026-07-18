import type { NotificationTemplateDefinition } from "./catalog";
import type { NotificationTemplateChannel } from "./catalog";
import type { PushNotificationType } from "@/lib/push/types";

export type NotificationTemplateTestRecipientProfile = {
  displayName: string;
  loginId: string;
  email: string | null;
  generation: number;
};

export type NotificationTemplateTestRecipientOption = {
  id: string;
  label: string;
  displayName: string;
  loginId: string;
  generation: number;
  channels: NotificationTemplateChannel[];
  isDefault: boolean;
};

type TemplateVariableSource = Pick<NotificationTemplateDefinition, "variables">;

const TEST_VALUES: Record<string, string | number> = {
  siteName: "싸트너십",
  title: "관리자 테스트 알림",
  body: "관리자 페이지에서 보낸 테스트 메시지입니다.",
  categoryLabel: "테스트",
  code: "123456",
  expiresInMinutes: 10,
  expirationNotice: "테스트 코드는 10분 동안 유효합니다.",
  subjectLabel: "테스트 안내",
  description: "관리자 페이지에서 보낸 테스트 안내입니다.",
  setupUrl: "/admin/notification-templates?status=test",
  applicationUrl: "/auth/signup/graduate",
  targetUrl: "/notifications",
  targetLink: "\n[알림 확인](/notifications)",
  partnerName: "테스트 제휴처",
  partnerCategory: "식음료",
  partnerLocation: "서울 강남구 역삼동",
  partnerUrl: "/partners/test-partner",
  campusNames: "서울 캠퍼스",
  benefitSummary: "테스트 혜택 10% 할인",
  conditions: "테스트 회원 인증 시 적용",
  periodStart: "2026-07-01",
  periodEnd: "2026-12-31",
  mapUrl: "https://map.example.com/test-partner",
  daysUntilEnd: "7",
  companyName: "테스트 파트너사",
  requesterName: "테스트 담당자",
  changeSummary: "테스트 변경 내용을 확인해 주세요.",
  requestUrl: "/admin/partner-registrations",
  currentPlanName: "Basic",
  previousPlanName: "Basic",
  requestedPlanName: "Premium",
  amountKrw: "150,000원",
  paymentDueAt: "2026-07-24 18:00",
  effectiveAt: "2026-07-18",
  expiresAt: "2026-08-17",
  planUrl: "/partner/plans",
  rejectionReason: "테스트 반려 사유입니다.",
  updatedByName: "테스트 운영자",
  targetLoginId: "myknow",
  actionName: "테스트 권한 변경",
  permissionTemplateName: "Super Admin",
  managedCampusNames: "서울 캠퍼스",
  adminUrl: "/admin",
  statusName: "활성화",
  actorLoginId: "myknow",
  note: "테스트 추가 안내입니다.",
  targets: "수료증 파일",
  reason: "테스트 반려 사유입니다.",
  contactName: "테스트 담당자",
  contactRole: "담당자",
  businessArea: "테스트 사업 분야",
  partnershipConditions: "테스트 제휴 조건",
  contactEmail: "test@example.com",
  companyUrl: "https://example.com/partner-test",
  loginId: "myknow",
  temporaryPassword: "TEST-ONLY-PASSWORD",
};

export function getNotificationTemplateTestVariables(
  template: TemplateVariableSource,
  recipient: NotificationTemplateTestRecipientProfile,
) {
  return Object.fromEntries(
    template.variables.map((variable) => {
      if (variable.name === "displayName") {
        return [variable.name, recipient.displayName || recipient.loginId];
      }
      if (variable.name === "loginId") {
        return [variable.name, recipient.loginId];
      }
      if (variable.name === "email") {
        return [variable.name, recipient.email ?? "test@example.com"];
      }
      if (variable.name in TEST_VALUES) {
        return [variable.name, TEST_VALUES[variable.name]];
      }
      return [variable.name, variable.example ?? `${variable.label} 테스트값`];
    }),
  ) as Record<string, string | number>;
}

export function getTestPushNotificationType(eventKey: string): PushNotificationType {
  if (eventKey.includes("marketing")) {
    return "marketing";
  }
  if (eventKey.includes("new_partner")) {
    return "new_partner";
  }
  if (eventKey.includes("expiring_partner")) {
    return "expiring_partner";
  }
  return "announcement";
}
