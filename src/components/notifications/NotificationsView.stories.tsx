"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import NotificationsView from "@/components/notifications/NotificationsView";
import { ToastProvider } from "@/components/ui/Toast";
import { DEFAULT_PUSH_PREFERENCES } from "@/lib/push";

const meta = {
  title: "Screens/Member/NotificationsView",
  component: NotificationsView,
  render: (args) => {
    if (typeof window !== "undefined") {
      window.fetch = async () => Response.json({ ok: true });
    }
    return <NotificationsView {...args} />;
  },
  decorators: [
    (Story) => (
      <ToastProvider>
        <Story />
      </ToastProvider>
    ),
  ],
  args: {
    notifications: {
      unreadCount: 1,
      nextOffset: 2,
      hasMore: false,
      items: [
        {
          id: "story-notification-new-partner",
          memberNotificationId: "story-member-notification-1",
          memberId: "story-member-notifications",
          type: "new_partner",
          title: "서울 캠퍼스에 새로운 제휴처가 등록됐어요",
          body: "역삼역 인근에서 이용할 수 있는 식음료 혜택을 확인해 보세요.",
          targetUrl: "/partners/story-campus-cafe",
          metadata: {},
          createdByMemberId: null,
          createdAt: "2026-07-10T09:00:00.000Z",
          readAt: null,
          deletedAt: null,
          updatedAt: "2026-07-10T09:00:00.000Z",
          isUnread: true,
        },
        {
          id: "story-notification-announcement",
          memberNotificationId: "story-member-notification-2",
          memberId: "story-member-notifications",
          type: "announcement",
          title: "제휴 이용 안내가 업데이트됐어요",
          body: "내 인증 화면을 제시하는 방법과 이용 유의사항을 확인해 주세요.",
          targetUrl: "/certification",
          metadata: {},
          createdByMemberId: null,
          createdAt: "2026-07-09T09:00:00.000Z",
          readAt: "2026-07-09T10:00:00.000Z",
          deletedAt: null,
          updatedAt: "2026-07-09T10:00:00.000Z",
          isUnread: false,
        },
      ],
    },
    pushSettings: {
      initialPreferences: { ...DEFAULT_PUSH_PREFERENCES },
      configured: false,
      marketingPolicy: null,
    },
  },
} satisfies Meta<typeof NotificationsView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
