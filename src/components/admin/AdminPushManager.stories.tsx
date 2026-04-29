import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { ToastProvider } from "@/components/ui/Toast";
import type { AdminPushManagerProps } from "./push-manager/types";
import AdminPushManager from "./AdminPushManager";

const pushProps: AdminPushManagerProps = {
  pushConfigured: true,
  mattermostConfigured: true,
  initialTab: "logs",
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

function installPushFetchMock() {
  const fetchMock = fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "/api/push/admin/preview") {
      return {
        ok: true,
        json: async () => ({
          preview: {
            notificationType: "announcement",
            selectedChannels: ["in_app", "push"],
            audienceScope: "all",
            audienceLabel: "전체 사용자",
            totalAudienceCount: 3,
            eligibleMemberCount: 2,
            eligibleMembers: [
              {
                id: "member-1",
                name: "김싸피",
                mmUsername: "ssafy15",
                year: 15,
                campus: "서울",
                channels: ["in_app", "push"],
              },
              {
                id: "member-2",
                name: "박운영",
                mmUsername: "ops15",
                year: 15,
                campus: "서울",
                channels: ["in_app"],
              },
            ],
            destinationLabel: "직접 URL 입력",
            channels: [
              {
                channel: "in_app",
                label: "인앱",
                eligibleCount: 2,
                excludedCount: 0,
                reasons: [],
              },
              {
                channel: "push",
                label: "푸시",
                eligibleCount: 1,
                excludedCount: 1,
                reasons: [{ code: "push_unsubscribed", label: "푸시 미구독", count: 1 }],
              },
            ],
            canSend: true,
            highRisk: false,
            requiresConfirmation: false,
            confirmationPhrase: "",
            validationMessage: null,
          },
        }),
      };
    }

    if (url === "/api/push/admin/broadcast") {
      return {
        ok: true,
        json: async () => ({
          result: {
            notificationId: "notification-1",
            preview: {},
            channelResults: {
              in_app: { targeted: 2, sent: 2, failed: 0, skipped: 0 },
              push: { targeted: 1, sent: 1, failed: 0, skipped: 0 },
              mm: { targeted: 0, sent: 0, failed: 0, skipped: 0 },
            },
          },
        }),
      };
    }

    return {
      ok: false,
      json: async () => ({ message: `Unhandled story fetch: ${url}` }),
    };
  }) as unknown as typeof fetch;
  globalThis.fetch = fetchMock;
  return fetchMock;
}

function installPreviewFailureFetchMock(message = "발송 검토 정보를 불러오지 못했습니다.") {
  const fetchMock = fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "/api/push/admin/preview") {
      return {
        ok: false,
        json: async () => ({ message }),
      };
    }
    return {
      ok: false,
      json: async () => ({ message: `Unhandled story fetch: ${url}` }),
    };
  }) as unknown as typeof fetch;
  globalThis.fetch = fetchMock;
  return fetchMock;
}

function installDeleteLogFetchMock() {
  const fetchMock = fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "/api/push/admin/logs/log-1") {
      return {
        ok: true,
        json: async () => ({ success: true }),
      };
    }
    return {
      ok: false,
      json: async () => ({ message: `Unhandled story fetch: ${url}` }),
    };
  }) as unknown as typeof fetch;
  globalThis.fetch = fetchMock;
  return fetchMock;
}

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByPlaceholderText("제목, 내용, URL, 대상 검색"), "분식랩");
    await expect(canvas.getByText("오늘 제휴 안내")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "불러오기" }));
    await expect(canvas.getByText("통합 알림 운영")).toBeInTheDocument();
    await expect(canvas.getByDisplayValue("오늘 제휴 안내")).toBeInTheDocument();
  },
};

export const PushNotConfigured: Story = {
  args: {
    pushConfigured: false,
  },
};

export const SendAnnouncement: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const fetchMock = installPushFetchMock();

    await userEvent.click(canvas.getByRole("button", { name: /알림 전송/ }));
    await userEvent.click(canvas.getByRole("button", { name: "3. 대상자 검색" }));
    await expect(await canvas.findByText("발송 가능 대상")).toBeInTheDocument();
    await userEvent.type(canvas.getByPlaceholderText("알림 제목"), "신규 제휴 안내");
    await userEvent.type(canvas.getByPlaceholderText("알림 내용"), "역삼 분식랩 신규 혜택이 적용되었습니다.");
    await userEvent.click(canvas.getByRole("button", { name: "3. 대상자 검색" }));
    await userEvent.click(canvas.getByRole("button", { name: "마지막 확인" }));
    await expect(await within(document.body).findByRole("button", { name: "메시지 보내기" })).toBeInTheDocument();
    await userEvent.click(within(document.body).getByRole("button", { name: "메시지 보내기" }));

    await expect(fetchMock).toHaveBeenCalledWith(
      "/api/push/admin/preview",
      expect.objectContaining({ method: "POST" }),
    );
    await expect(fetchMock).toHaveBeenCalledWith(
      "/api/push/admin/broadcast",
      expect.objectContaining({ method: "POST" }),
    );
  },
};

export const PreviewFailure: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const fetchMock = installPreviewFailureFetchMock("대상자 미리보기를 다시 시도해 주세요.");

    await userEvent.click(canvas.getByRole("button", { name: /알림 전송/ }));
    await userEvent.click(canvas.getByRole("button", { name: "3. 대상자 검색" }));

    await expect(
      await canvas.findByText("대상자 미리보기를 다시 시도해 주세요."),
    ).toBeInTheDocument();
    await expect(fetchMock).toHaveBeenCalledWith(
      "/api/push/admin/preview",
      expect.objectContaining({ method: "POST" }),
    );
  },
};

export const DeleteLog: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const fetchMock = installDeleteLogFetchMock();
    const originalConfirm = window.confirm;
    window.confirm = fn(() => true);

    try {
      await expect(canvas.getByText("오늘 제휴 안내")).toBeInTheDocument();
      await userEvent.click(canvas.getByRole("button", { name: "삭제" }));
      await expect(fetchMock).toHaveBeenCalledWith(
        "/api/push/admin/logs/log-1",
        expect.objectContaining({ method: "DELETE" }),
      );
      await expect(canvas.queryByText("오늘 제휴 안내")).not.toBeInTheDocument();
    } finally {
      window.confirm = originalConfirm;
    }
  },
};

export const DeleteLogCancelled: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const originalConfirm = window.confirm;
    const confirmMock = fn(() => false);
    window.confirm = confirmMock;

    try {
      await userEvent.click(canvas.getByRole("button", { name: "삭제" }));
      await expect(confirmMock).toHaveBeenCalled();
      await expect(canvas.getByText("오늘 제휴 안내")).toBeInTheDocument();
    } finally {
      window.confirm = originalConfirm;
    }
  },
};
