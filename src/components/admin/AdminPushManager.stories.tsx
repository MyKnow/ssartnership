import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ToastProvider } from "@/components/ui/Toast";
import type { AdminPushManagerProps } from "./push-manager/types";
import AdminPushManager from "./AdminPushManager";

const pushProps: AdminPushManagerProps = {
  pushConfigured: true,
  mattermostConfigured: true,
  partners: [
    { id: "partner-1", name: "역삼 분식랩" },
    { id: "partner-2", name: "카페 루프 역삼점" },
  ],
  members: [
    {
      id: "member-1",
      display_name: "김싸피",
      mm_username: "ssafy15",
      year: 15,
      campus: "서울",
    },
    {
      id: "member-2",
      display_name: "박운영",
      mm_username: "ops15",
      year: 15,
      campus: "서울",
    },
    {
      id: "member-3",
      display_name: "최동문",
      mm_username: "alumni14",
      year: 14,
      campus: "대전",
    },
  ],
  recentLogs: [
    {
      id: "log-1",
      notificationType: "announcement",
      title: "오늘 제휴 안내",
      body: "역삼 분식랩 신규 혜택이 적용되었습니다.",
      url: "/partners/partner-1",
      source: "manual",
      selectedChannels: ["in_app", "push"],
      targetScope: "all",
      targetLabel: "전체 사용자",
      targetYear: null,
      targetCampus: null,
      targetMemberId: null,
      status: "sent",
      totalAudienceCount: 240,
      marketing: false,
      channelResults: {
        in_app: {
          targeted: 240,
          sent: 240,
          failed: 0,
          skipped: 0,
        },
        push: {
          targeted: 240,
          sent: 238,
          failed: 2,
          skipped: 0,
        },
        mm: {
          targeted: 0,
          sent: 0,
          failed: 0,
          skipped: 0,
        },
      },
      exclusionReasons: [],
      createdAt: "2026-04-25T08:30:00.000Z",
      completedAt: "2026-04-25T08:31:30.000Z",
    },
  ],
  automaticSummaries: [
    {
      notificationType: "new_partner",
      label: "신규 제휴 자동 알림",
      lastRunAt: "2026-04-25T07:00:00.000Z",
      recentCount: 2,
      failedCount: 0,
      failureSamples: [],
    },
    {
      notificationType: "expiring_partner",
      label: "만료 예정 제휴 알림",
      lastRunAt: "2026-04-24T23:00:00.000Z",
      recentCount: 1,
      failedCount: 1,
      failureSamples: ["partner-9: push token missing"],
    },
  ],
};

const meta = {
  title: "Domains/Admin/AdminPushManager",
  component: AdminPushManager,
  args: pushProps,
  decorators: [
    (Story) => (
      <ToastProvider>
        <Story />
      </ToastProvider>
    ),
  ],
} satisfies Meta<typeof AdminPushManager>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const PushNotConfigured: Story = {
  args: {
    pushConfigured: false,
  },
};
