import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { ToastProvider } from "@/components/ui/Toast";
import type { AdminLogsPageData } from "@/lib/log-insights";
import AdminLogsManager from "./AdminLogsManager";

const logsData: AdminLogsPageData = {
  range: {
    preset: "24h",
    start: "2026-04-24T00:00:00.000Z",
    end: "2026-04-25T00:00:00.000Z",
    label: "2026-04-24 09:00 ~ 2026-04-25 09:00",
    bucketLabel: "1시간 단위",
    durationMs: 24 * 60 * 60 * 1000,
  },
  counts: {
    product: 842,
    audit: 57,
    security: 18,
  },
  truncated: {
    product: false,
    audit: false,
    security: false,
    any: false,
    limitPerGroup: 2000,
  },
  chartBuckets: [
    {
      key: "bucket-1",
      label: "09:00",
      rangeLabel: "09:00 ~ 10:00",
      start: "2026-04-24T00:00:00.000Z",
      end: "2026-04-24T01:00:00.000Z",
      product: 44,
      audit: 2,
      security: 0,
      total: 46,
    },
    {
      key: "bucket-2",
      label: "12:00",
      rangeLabel: "12:00 ~ 13:00",
      start: "2026-04-24T03:00:00.000Z",
      end: "2026-04-24T04:00:00.000Z",
      product: 117,
      audit: 6,
      security: 3,
      total: 126,
    },
    {
      key: "bucket-3",
      label: "18:00",
      rangeLabel: "18:00 ~ 19:00",
      start: "2026-04-24T09:00:00.000Z",
      end: "2026-04-24T10:00:00.000Z",
      product: 92,
      audit: 4,
      security: 1,
      total: 97,
    },
  ],
  filters: {
    availableNames: [
      { value: "partner_view", label: "partner_view" },
      { value: "partner_search", label: "partner_search" },
      { value: "partner.updated", label: "partner.updated" },
      { value: "notification.broadcast", label: "notification.broadcast" },
      { value: "login", label: "login" },
      { value: "signup_verify", label: "signup_verify" },
    ],
    actorOptions: ["admin", "guest", "member"],
  },
  summary: {
    topProductEvents: [{ label: "partner_view", value: "1건" }],
    topAuditActions: [{ label: "partner.updated", value: "1건" }],
    topActors: [{ label: "member:ssafy15", value: "2건" }],
    topIps: [{ label: "127.0.0.1", value: "3건" }],
    topPaths: [{ label: "/auth/login", value: "2건" }],
    securityStatusCounts: {
      success: 1,
      failure: 1,
      blocked: 1,
    },
  },
  list: {
    productLogs: [
      {
        id: "product-1",
        session_id: "session-1",
        actor_type: "member",
        actor_id: "member-1",
        actor_name: "김싸피",
        actor_mm_username: "ssafy15",
        event_name: "partner_view",
        path: "/partners/partner-1",
        referrer: "/",
        target_type: "partner",
        target_id: "partner-1",
        properties: { partnerName: "역삼 분식랩" },
        ip_address: "127.0.0.1",
        created_at: "2026-04-24T03:15:00.000Z",
      },
      {
        id: "product-2",
        session_id: "session-2",
        actor_type: "guest",
        actor_id: null,
        actor_name: null,
        actor_mm_username: null,
        event_name: "partner_search",
        path: "/partners",
        referrer: "/partners/partner-1",
        target_type: "search",
        target_id: "분식",
        properties: { query: "분식", resultCount: 3 },
        ip_address: "127.0.0.2",
        created_at: "2026-04-24T02:10:00.000Z",
      },
    ],
    auditLogs: [
      {
        id: "audit-1",
        actor_id: "admin-1",
        action: "partner.updated",
        path: "/admin/partners/partner-1",
        target_type: "partner",
        target_id: "partner-1",
        properties: { field: "benefits" },
        ip_address: "127.0.0.1",
        created_at: "2026-04-24T04:10:00.000Z",
      },
      {
        id: "audit-2",
        actor_id: "admin-2",
        action: "notification.broadcast",
        path: "/admin/push",
        target_type: "campaign",
        target_id: "campaign-1",
        properties: { channels: ["push", "mm"], total: 27 },
        ip_address: "127.0.0.3",
        created_at: "2026-04-24T01:30:00.000Z",
      },
    ],
    securityLogs: [
      {
        id: "security-1",
        event_name: "login",
        status: "success",
        actor_type: "member",
        actor_id: "member-1",
        actor_name: "김싸피",
        actor_mm_username: "ssafy15",
        identifier: "ssafy15",
        path: "/auth/login",
        properties: null,
        ip_address: "127.0.0.1",
        created_at: "2026-04-24T05:00:00.000Z",
      },
      {
        id: "security-2",
        event_name: "login",
        status: "failure",
        actor_type: "member",
        actor_id: "member-2",
        actor_name: "이싸피",
        actor_mm_username: "ssafy-fail",
        identifier: "ssafy-fail",
        path: "/auth/login",
        properties: { reason: "invalid_password" },
        ip_address: "127.0.0.4",
        created_at: "2026-04-24T00:30:00.000Z",
      },
      {
        id: "security-3",
        event_name: "signup_verify",
        status: "blocked",
        actor_type: "guest",
        actor_id: null,
        actor_name: null,
        actor_mm_username: null,
        identifier: "blocked-user",
        path: "/auth/signup",
        properties: { reason: "rate_limited" },
        ip_address: "127.0.0.5",
        created_at: "2026-04-24T00:20:00.000Z",
      },
    ],
    total: 7,
    page: 1,
    pageSize: 100,
  },
};

function installLogsFetchMock() {
  window.fetch = async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith("/api/admin/logs/export")) {
      return new Response("group,name\nproduct,partner_view\n", {
        status: 200,
        headers: { "Content-Type": "text/csv" },
      });
    }
    if (url.startsWith("/api/admin/logs")) {
      return Response.json({
        ...logsData,
        range: {
          ...logsData.range,
          preset: url.includes("preset=custom") ? "custom" : "7d",
          label: url.includes("preset=custom")
            ? "사용자 지정 범위"
            : "최근 7일",
        },
      } satisfies AdminLogsPageData);
    }
    return Response.json({ message: `Unhandled story fetch: ${url}` }, { status: 404 });
  };
}

const meta = {
  title: "Domains/Admin/AdminLogsManager",
  component: AdminLogsManager,
  args: {
    initialData: logsData,
  },
  decorators: [
    (Story) => (
      <ToastProvider>
        <Story />
      </ToastProvider>
    ),
  ],
} satisfies Meta<typeof AdminLogsManager>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const InteractiveFiltersAndExport: Story = {
  play: async ({ canvasElement }) => {
    installLogsFetchMock();
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: "일주일" }));
    await expect(await canvas.findByText("최근 7일")).toBeInTheDocument();

    await userEvent.selectOptions(canvas.getByLabelText("로그 그룹"), "security");
    await userEvent.selectOptions(canvas.getByLabelText("보안 상태"), "failure");
    await expect(canvas.getAllByText("login").length).toBeGreaterThan(0);

    await userEvent.clear(canvas.getByPlaceholderText("유저명, @MM 아이디, IP, 경로, 대상, 속성으로 검색"));
    await userEvent.type(
      canvas.getByPlaceholderText("유저명, @MM 아이디, IP, 경로, 대상, 속성으로 검색"),
      "ssafy-fail",
    );
    await expect(canvas.getByText("MM 아이디: @ssafy-fail")).toBeInTheDocument();

    await userEvent.selectOptions(canvas.getByLabelText("정렬"), "oldest");
    await userEvent.click(canvas.getAllByText("상세 보기")[0]!);
    await expect(canvas.getAllByText("properties").length).toBeGreaterThan(0);

    await userEvent.selectOptions(canvas.getByLabelText("페이지당"), "50");
    await userEvent.clear(canvas.getByRole("spinbutton"));
    await userEvent.type(canvas.getByRole("spinbutton"), "4");
    await userEvent.click(canvas.getByRole("button", { name: "이동" }));
    await expect(canvas.getByText("1 / 1")).toBeInTheDocument();

    await userEvent.click(canvas.getByRole("button", { name: "사용자 지정" }));
    await userEvent.clear(canvas.getByLabelText("시작 시각"));
    await userEvent.type(canvas.getByLabelText("시작 시각"), "2026-04-24T00:00");
    await userEvent.clear(canvas.getByLabelText("종료 시각"));
    await userEvent.type(canvas.getByLabelText("종료 시각"), "2026-04-24T06:00");
    await userEvent.click(canvas.getByRole("button", { name: "범위 적용" }));
    await expect(await canvas.findByText("사용자 지정 범위")).toBeInTheDocument();

    await userEvent.click(canvas.getByRole("button", { name: "CSV 다운로드" }));
    await expect(within(document.body).getAllByText("CSV 다운로드").length).toBeGreaterThan(1);
    await userEvent.click(within(document.body).getByRole("checkbox", { name: "인증·보안" }));
    const downloadButtons = within(document.body).getAllByRole("button", { name: "CSV 다운로드" });
    await userEvent.click(downloadButtons[downloadButtons.length - 1]!);
  },
};

export const Truncated: Story = {
  args: {
    initialData: {
      ...logsData,
      truncated: {
        product: true,
        audit: false,
        security: true,
        any: true,
        limitPerGroup: 2000,
      },
    },
  },
};
