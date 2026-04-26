import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import type { AdminNotificationOperationLog } from "@/lib/admin-notification-ops";
import { PushLogsSection } from "./PushLogsSection";
import type { AdminPushManagerProps, SortOption } from "./types";

const automaticSummaries: AdminPushManagerProps["automaticSummaries"] = [
  {
    notificationType: "new_partner",
    label: "신규 제휴 자동 알림",
    lastRunAt: "2026-04-26T00:00:00.000Z",
    recentCount: 3,
    failedCount: 1,
    failureSamples: ["MM 사용자 미연결"],
  },
  {
    notificationType: "expiring_partner",
    label: "종료 임박 자동 알림",
    lastRunAt: null,
    recentCount: 0,
    failedCount: 0,
    failureSamples: [],
  },
];

const filteredLogs: AdminNotificationOperationLog[] = [
  {
    id: "log-1",
    notificationType: "announcement",
    source: "manual",
    selectedChannels: ["in_app", "push"],
    targetScope: "campus",
    targetLabel: "서울 캠퍼스",
    targetYear: null,
    targetCampus: "서울",
    targetMemberId: null,
    title: "서울 제휴처 업데이트",
    body: "분식랩 제휴 혜택이 갱신되었습니다.",
    url: "/partners/partner-1",
    status: "partial_failed",
    totalAudienceCount: 12,
    marketing: false,
    channelResults: {
      in_app: { targeted: 12, sent: 12, failed: 0, skipped: 0 },
      push: { targeted: 10, sent: 8, failed: 2, skipped: 0 },
      mm: { targeted: 0, sent: 0, failed: 0, skipped: 0 },
    },
    exclusionReasons: [{ code: "no_push_subscription", label: "푸시 미구독", count: 2 }],
    createdAt: "2026-04-26T03:30:00.000Z",
    completedAt: "2026-04-26T03:31:00.000Z",
  },
  {
    id: "log-2",
    notificationType: "marketing",
    source: "automatic",
    selectedChannels: ["in_app", "mm"],
    targetScope: "all",
    targetLabel: "전체 사용자",
    targetYear: null,
    targetCampus: null,
    targetMemberId: null,
    title: "이벤트 공지",
    body: "오늘 저녁 현장 이벤트가 진행됩니다.",
    url: null,
    status: "sent",
    totalAudienceCount: 42,
    marketing: true,
    channelResults: {
      in_app: { targeted: 42, sent: 42, failed: 0, skipped: 0 },
      push: { targeted: 0, sent: 0, failed: 0, skipped: 0 },
      mm: { targeted: 35, sent: 35, failed: 0, skipped: 0 },
    },
    exclusionReasons: [],
    createdAt: "2026-04-25T10:00:00.000Z",
    completedAt: "2026-04-25T10:01:00.000Z",
  },
];

function StatefulPushLogsSection({
  initialLogs = filteredLogs,
  readOnly = false,
  onLoadLog = fn(),
  onDeleteLog = async () => {},
}: {
  initialLogs?: AdminNotificationOperationLog[];
  readOnly?: boolean;
  onLoadLog?: (log: AdminNotificationOperationLog) => void;
  onDeleteLog?: (logId: string) => Promise<void>;
}) {
  const [logs, setLogs] = useState(initialLogs);
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);
  const [filters, setFilters] = useState<{
    search: string;
    typeFilter: "all" | AdminNotificationOperationLog["notificationType"];
    sourceFilter: "all" | AdminNotificationOperationLog["source"];
    statusFilter: "all" | AdminNotificationOperationLog["status"];
    audienceFilter: "all" | AdminNotificationOperationLog["targetScope"];
    sort: SortOption;
  }>({
    search: "",
    typeFilter: "all",
    sourceFilter: "all",
    statusFilter: "all",
    audienceFilter: "all",
    sort: "newest",
  });

  return (
    <PushLogsSection
      automaticSummaries={automaticSummaries}
      filteredLogs={logs}
      deletingLogId={deletingLogId}
      filters={filters}
      readOnly={readOnly}
      onUpdateFilter={(key, value) => {
        setFilters((current) => ({ ...current, [key]: value }));
      }}
      onLoadLog={readOnly ? undefined : onLoadLog}
      onDeleteLog={
        readOnly
          ? undefined
          : async (logId) => {
              setDeletingLogId(logId);
              await onDeleteLog(logId);
              setLogs((current) => current.filter((log) => log.id !== logId));
              setDeletingLogId(null);
            }
      }
    />
  );
}

const meta = {
  title: "Domains/Admin/PushLogsSection",
  component: StatefulPushLogsSection,
  args: {
    initialLogs: filteredLogs,
    readOnly: false,
    onLoadLog: fn(),
    onDeleteLog: fn(async () => {}),
  },
} satisfies Meta<typeof StatefulPushLogsSection>;

export default meta;

type Story = StoryObj<typeof meta>;

export const InteractiveLogs: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("자동 알림 상태")).toBeInTheDocument();
    await expect(canvas.getByText("서울 제휴처 업데이트")).toBeInTheDocument();
    await expect(canvas.getByText("이벤트 공지")).toBeInTheDocument();

    await userEvent.type(canvas.getByPlaceholderText("제목, 내용, URL, 대상 검색"), "서울");
    await expect(canvas.getByDisplayValue("서울")).toBeInTheDocument();

    const selects = canvas.getAllByRole("combobox");
    await userEvent.selectOptions(selects[1], "partial_failed");
    await userEvent.selectOptions(selects[2], "failed");
    await expect(selects[1]).toHaveValue("partial_failed");
    await expect(selects[2]).toHaveValue("failed");

    await userEvent.click(canvas.getAllByRole("button", { name: "불러오기" })[0]);
    await expect(args.onLoadLog).toHaveBeenCalledWith(expect.objectContaining({ id: "log-1" }));

    await userEvent.click(canvas.getAllByRole("button", { name: "삭제" })[0]);
    await waitFor(async () => {
      await expect(args.onDeleteLog).toHaveBeenCalledWith("log-1");
      await expect(canvas.queryByText("서울 제휴처 업데이트")).not.toBeInTheDocument();
    });
  },
};

export const EmptyAndReadOnly: Story = {
  args: {
    initialLogs: [],
    readOnly: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("조건에 맞는 알림 운영 로그가 없습니다.")).toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "불러오기" })).not.toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "삭제" })).not.toBeInTheDocument();
  },
};
