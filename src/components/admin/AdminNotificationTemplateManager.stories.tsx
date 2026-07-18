import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import type { ResolvedNotificationTemplate } from "@/lib/notification-templates/repository.server";
import AdminNotificationTemplateManager from "./AdminNotificationTemplateManager";

const templates: ResolvedNotificationTemplate[] = [
  {
    eventKey: "email.graduate_rejection",
    label: "수료생 인증 반려",
    description: "관리자가 수료생 인증 신청을 반려했을 때 전송하는 이메일입니다.",
    group: "회원·수료생 이메일",
    channel: "email",
    titleTemplate: "[{siteName}] 수료생 인증 신청 반려",
    bodyTemplate: "{displayName}님, 신청이 반려되었습니다.\n반려 사유: {reason}\n{applicationUrl}",
    bodyFormat: "markdown",
    variables: [
      { name: "siteName", label: "서비스 이름" },
      { name: "displayName", label: "수신자 이름" },
      { name: "reason", label: "반려 사유" },
      { name: "applicationUrl", label: "재신청 URL" },
    ],
    requiredVariables: ["siteName", "displayName", "reason", "applicationUrl"],
    source: "transactional",
    audience: "recipient",
    trigger: "관리자가 수료생 인증을 반려했을 때",
    isActive: true,
    legacy: false,
    isCustomized: false,
    hasLegacyOverride: false,
    customizationError: null,
    updatedAt: null,
    updatedBy: null,
  },
  {
    eventKey: "mattermost.signup_code",
    label: "Mattermost 회원가입 인증 코드",
    description: "회원가입 시 Mattermost DM으로 전송하는 6자리 코드입니다.",
    group: "Mattermost",
    channel: "mattermost",
    titleTemplate: "회원가입 인증 코드",
    bodyTemplate: "[싸트너십] {title}\n인증 코드: `{code}`",
    bodyFormat: "plain",
    variables: [
      { name: "title", label: "메시지 제목" },
      { name: "code", label: "인증 코드" },
    ],
    requiredVariables: ["title", "code"],
    source: "transactional",
    audience: "member",
    trigger: "Mattermost 회원가입 인증을 요청했을 때",
    isActive: true,
    legacy: false,
    isCustomized: true,
    hasLegacyOverride: false,
    customizationError: null,
    updatedAt: "2026-07-17T12:00:00.000Z",
    updatedBy: "admin-1",
  },
  {
    eventKey: "push.partner_new_offer",
    label: "신규 제휴 푸시 알림",
    description: "새로운 제휴 혜택을 안내하는 푸시 알림입니다.",
    group: "운영 캠페인",
    channel: "push",
    titleTemplate: "새로운 제휴 혜택이 도착했습니다",
    bodyTemplate: "{displayName}님, {partnerName}의 새 혜택을 확인해 보세요.",
    bodyFormat: "plain",
    variables: [
      { name: "displayName", label: "수신자 이름" },
      { name: "partnerName", label: "제휴처 이름" },
    ],
    requiredVariables: ["displayName", "partnerName"],
    source: "automatic",
    audience: "member",
    trigger: "신규 제휴가 등록되었을 때",
    contextKey: "new_partner",
    isActive: true,
    legacy: false,
    isCustomized: false,
    hasLegacyOverride: false,
    customizationError: null,
    updatedAt: null,
    updatedBy: null,
  },
];

const meta = {
  title: "Domains/Admin/AdminNotificationTemplateManager",
  component: AdminNotificationTemplateManager,
  args: {
    templates,
    updateAction: fn(async () => {}),
    resetAction: fn(async () => {}),
    testAction: fn(async () => {}),
    testRecipients: [
      {
        id: "member-myknow",
        label: "테스트 관리자 (myknow) · 운영진",
        displayName: "테스트 관리자",
        loginId: "myknow",
        generation: 0,
        channels: ["email", "mattermost", "push", "in_app"],
        isDefault: true,
      },
    ],
    defaultTestRecipientId: "member-myknow",
  },
  parameters: {
    chromatic: { viewports: [360, 820, 1366] },
  },
} satisfies Meta<typeof AdminNotificationTemplateManager>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const VariableInsertion: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText("수료생 인증 반려", { exact: true }));
    const reasonLabel = canvas.getByText("반려 사유", { exact: true });
    await userEvent.click(reasonLabel.parentElement?.querySelector("button:last-child") as HTMLButtonElement);
    const body = canvas.getAllByLabelText("내용 템플릿")[0] as HTMLTextAreaElement;
    expect(body.value).toContain("{reason}");
  },
};

export const FilterAndSearch: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const search = canvas.getByRole("textbox", { name: "템플릿 검색" });

    await userEvent.type(search, "반려");
    expect(canvas.getByText("수료생 인증 반려")).toBeInTheDocument();
    expect(canvas.queryByText("Mattermost 회원가입 인증 코드")).not.toBeInTheDocument();

    await userEvent.clear(search);
    const channel = canvas.getByRole("combobox", { name: "채널 필터" });
    await userEvent.selectOptions(channel, "push");
    expect(canvas.getByText("신규 제휴 푸시 알림")).toBeInTheDocument();
    expect(canvas.queryByText("수료생 인증 반려")).not.toBeInTheDocument();

    await userEvent.selectOptions(channel, "all");
    const status = canvas.getByRole("combobox", { name: "상태 필터" });
    await userEvent.selectOptions(status, "customized");
    expect(canvas.getByText("Mattermost 회원가입 인증 코드")).toBeInTheDocument();
    expect(canvas.queryByText("수료생 인증 반려")).not.toBeInTheDocument();
  },
};
