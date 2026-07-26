import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { ToastProvider } from "@/components/ui/Toast";
import AdminNotificationsView from "./AdminNotificationsView";

const now = "2026-07-10T10:30:00+09:00";

const meta = {
  title: "Domains/Admin/AdminNotificationsView",
  component: AdminNotificationsView,
  decorators: [
    (Story) => (
      <ToastProvider>
        <Story />
      </ToastProvider>
    ),
  ],
  args: {
    notificationResult: {
      unreadCount: 2,
      nextOffset: 2,
      hasMore: false,
      items: [
        {
          id: "admin-notification-request",
          adminNotificationRecipientId: "recipient-request",
          notificationId: "notification-request",
          type: "partner_change_request",
          title: "카페 싸피 역삼점 변경 요청이 도착했습니다",
          body: "위치와 혜택 변경 내용을 확인한 뒤 승인하거나 거절해 주세요.",
          targetUrl: "/admin/partner-requests",
          metadata: {},
          readAt: null,
          deletedAt: null,
          createdAt: now,
          updatedAt: now,
          isUnread: true,
        },
        {
          id: "admin-notification-security",
          adminNotificationRecipientId: "recipient-security",
          notificationId: "notification-security",
          type: "security_alert",
          title: "관리자 로그인 실패가 반복되었습니다",
          body: "보안 로그에서 계정과 IP를 확인해 주세요.",
          targetUrl: "/admin/logs",
          metadata: {},
          readAt: null,
          deletedAt: null,
          createdAt: "2026-07-10T09:20:00+09:00",
          updatedAt: "2026-07-10T09:20:00+09:00",
          isUnread: true,
        },
      ],
    },
    preferences: {
      enabled: true,
      portalEnabled: true,
      pushEnabled: true,
      securityEnabled: true,
      partnerRequestEnabled: true,
      expiringPartnerEnabled: true,
    },
    deviceCount: 2,
    pushConfigured: true,
    publicKey: "storybook-public-key",
    canSend: true,
  },
  parameters: {
    nextjs: { appDirectory: true },
    chromatic: { viewports: [360, 820, 1366] },
  },
} satisfies Meta<typeof AdminNotificationsView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LoadError: Story = {
  args: {
    loadError: true,
  },
};

export const ReadOnly: Story = {
  args: {
    canSend: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("수신함", { exact: true }),
    ).toBeInTheDocument();
    await expect(canvas.getByText("결과", { exact: true })).toBeInTheDocument();
    await expect(
      canvas.queryByText("작성", { exact: true }),
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole("link", { name: /알림 전송/ }),
    ).not.toBeInTheDocument();
  },
};
