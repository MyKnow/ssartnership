import type { Meta, StoryObj } from "@storybook/nextjs-vite";
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
      user_agent: "Mozilla/5.0",
      ip_address: "127.0.0.1",
      created_at: "2026-04-24T03:15:00.000Z",
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
      user_agent: "Mozilla/5.0",
      ip_address: "127.0.0.1",
      created_at: "2026-04-24T04:10:00.000Z",
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
      user_agent: "Mozilla/5.0",
      ip_address: "127.0.0.1",
      created_at: "2026-04-24T05:00:00.000Z",
    },
  ],
};

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
