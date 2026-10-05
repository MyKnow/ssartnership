import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import AdminNotificationInbox from "./AdminNotificationInbox";
import { ToastProvider } from "@/components/ui/Toast";
import type { AdminNotificationInboxItem } from "@/lib/admin-notification-inbox";
const item: AdminNotificationInboxItem = {
  id: "story-read", adminNotificationRecipientId: "story-recipient", notificationId: "story-notification",
  type: "partner_registration", title: "제휴 신청 검토가 필요합니다", body: "접수된 신청의 내용을 확인해 주세요.",
  targetUrl: "/admin/partner-registrations", metadata: {}, readAt: "2026-10-05T01:00:00Z", deletedAt: null,
  createdAt: "2026-10-05T00:00:00Z", updatedAt: "2026-10-05T01:00:00Z", isUnread: false,
};
const meta = {
  title: "Domains/Admin/NotificationInbox", component: AdminNotificationInbox,
  decorators: [(Story) => <ToastProvider><Story /></ToastProvider>],
  args: { initialState: { unreadCount: 1, items: [item, { ...item, id: "story-unread", adminNotificationRecipientId: "story-unread-recipient", readAt: null, isUnread: true }], nextOffset: 2, hasMore: false } },
} satisfies Meta<typeof AdminNotificationInbox>;
export default meta;
type Story = StoryObj<typeof meta>;
export const ReadAndUnread: Story = {};
export const Empty: Story = { args: { initialState: { unreadCount: 0, items: [], nextOffset: 0, hasMore: false } } };
