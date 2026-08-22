import { renderTransactionalEmail } from "@/lib/email-content";
import { SITE_NAME } from "@/lib/site";

type GraduateVerificationEmailContentInput =
  | Readonly<{
      kind: "application_code";
      code: string;
      expirationNotice: string;
    }>
  | Readonly<{
      kind: "password_reset_code";
      code: string;
      expirationNotice: string;
    }>
  | Readonly<{
      kind: "account_setup";
      displayName: string;
      setupUrl: string;
      isExistingMemberRecovery: boolean;
    }>
  | Readonly<{
      kind: "password_reset";
      displayName: string;
      setupUrl: string;
    }>
  | Readonly<{
      kind: "resubmission";
      displayName: string;
      targets: readonly string[];
      note: string | null;
      applicationUrl: string;
    }>
  | Readonly<{
      kind: "rejection";
      displayName: string;
      reason: string;
      applicationUrl: string;
    }>;

function renderCodeEmail(
  input: Extract<
    GraduateVerificationEmailContentInput,
    { kind: "application_code" | "password_reset_code" }
  >,
) {
  const isPasswordReset = input.kind === "password_reset_code";
  return renderTransactionalEmail({
    preheader: isPasswordReset
      ? "비밀번호 재설정을 계속하려면 6자리 인증 코드를 입력해 주세요."
      : "가입을 계속하려면 6자리 인증 코드를 입력해 주세요.",
    kicker: isPasswordReset ? "계정 보안" : "이메일 인증",
    title: isPasswordReset
      ? ["비밀번호 재설정", "인증 코드"]
      : "수료생 인증 코드",
    lead: [
      isPasswordReset
        ? "비밀번호 재설정을 계속하려면 아래 인증 코드를 입력해 주세요."
        : `${SITE_NAME} 가입을 계속하려면 아래 인증 코드를 입력해 주세요.`,
    ],
    code: {
      label: "6자리 인증 코드",
      value: input.code,
    },
    panels: [
      {
        tone: "info",
        title: input.expirationNotice,
        body: [
          "본인이 요청하지 않았다면 별도의 조치를 하지 않아도 됩니다. 인증 코드를 다른 사람에게 전달하지 마세요.",
        ],
      },
    ],
  });
}

function renderAccountSetupEmail(
  input: Extract<
    GraduateVerificationEmailContentInput,
    { kind: "account_setup" }
  >,
) {
  if (input.isExistingMemberRecovery) {
    return renderTransactionalEmail({
      preheader: "기존 회원 계정 복구가 승인되었습니다. 새 비밀번호를 설정해 주세요.",
      kicker: "계정 복구",
      title: ["계정 복구가", "승인되었습니다"],
      lead: [
        `${input.displayName}님, 기존 회원 복구 요청의 검토가 완료되었습니다.`,
      ],
      panels: [
        {
          tone: "success",
          title: "복구 승인 완료",
          body: ["아래 버튼을 눌러 새 비밀번호를 설정해 주세요."],
        },
      ],
      action: {
        label: "새 비밀번호 설정하기",
        url: input.setupUrl,
      },
    });
  }

  return renderTransactionalEmail({
    preheader: "수료생 인증이 완료되었습니다. 계정 설정을 마무리해 주세요.",
    kicker: "가입 승인",
    title: [`${SITE_NAME}에`, "오신 것을 환영합니다"],
    lead: [
      `${input.displayName}님, 제출하신 수료생 인증 자료의 검토가 완료되었습니다.`,
    ],
    panels: [
      {
        tone: "success",
        title: "인증 승인 완료",
        body: [`이제 ${SITE_NAME}의 구성원 전용 제휴 혜택을 이용할 수 있습니다.`],
      },
    ],
    action: {
      label: "계정 설정 완료하기",
      url: input.setupUrl,
    },
  });
}

function renderPasswordResetEmail(
  input: Extract<
    GraduateVerificationEmailContentInput,
    { kind: "password_reset" }
  >,
) {
  return renderTransactionalEmail({
    preheader: "요청하신 비밀번호 재설정 링크를 보내드렸습니다.",
    kicker: "계정 보안",
    title: ["비밀번호를", "다시 설정해 주세요"],
    lead: [
      `${input.displayName}님, 요청하신 비밀번호 재설정 링크를 보내드렸습니다.`,
      "아래 버튼을 눌러 새 비밀번호를 설정해 주세요.",
    ],
    action: {
      label: "비밀번호 재설정하기",
      url: input.setupUrl,
    },
  });
}

function renderResubmissionEmail(
  input: Extract<
    GraduateVerificationEmailContentInput,
    { kind: "resubmission" }
  >,
) {
  return renderTransactionalEmail({
    preheader: "확인이 필요한 인증 자료가 있습니다. 보완 항목을 확인해 주세요.",
    kicker: "인증 보완",
    title: "확인이 필요한 항목이 있어요",
    titleSingleLine: true,
    lead: [
      `${input.displayName}님, 수료생 인증을 완료하려면 아래 자료를 한 번 더 확인해 주세요.`,
    ],
    panels: [
      {
        tone: "warning",
        title: "보완이 필요한 항목",
        items: input.targets,
      },
      ...(input.note
        ? [
            {
              tone: "info" as const,
              title: "관리자 안내",
              body: [input.note],
            },
          ]
        : []),
    ],
    action: {
      label: "보완 자료 제출하기",
      url: input.applicationUrl,
    },
  });
}

function renderRejectionEmail(
  input: Extract<
    GraduateVerificationEmailContentInput,
    { kind: "rejection" }
  >,
) {
  return renderTransactionalEmail({
    preheader: "수료생 인증 신청 결과와 반려 사유를 확인해 주세요.",
    kicker: "인증 결과",
    title: ["인증 신청이", "반려되었습니다"],
    lead: [
      `${input.displayName}님, 제출하신 수료생 인증 자료의 검토가 완료되었습니다.`,
    ],
    panels: [
      {
        tone: "warning",
        title: "반려 사유",
        body: [input.reason],
      },
    ],
    action: {
      label: "다시 신청하기",
      url: input.applicationUrl,
    },
  });
}

export function renderGraduateVerificationEmailContent(
  input: GraduateVerificationEmailContentInput,
) {
  if (
    input.kind === "application_code" ||
    input.kind === "password_reset_code"
  ) {
    return renderCodeEmail(input);
  }
  if (input.kind === "account_setup") {
    return renderAccountSetupEmail(input);
  }
  if (input.kind === "password_reset") {
    return renderPasswordResetEmail(input);
  }
  if (input.kind === "resubmission") {
    return renderResubmissionEmail(input);
  }
  return renderRejectionEmail(input);
}
