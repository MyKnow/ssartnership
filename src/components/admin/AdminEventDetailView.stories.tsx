import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { getEventPageDefinition } from "@/lib/event-pages";
import type { ManagedEventCampaign } from "@/lib/promotions/events";
import AdminEventDetailView from "./AdminEventDetailView";

const definition = getEventPageDefinition("signup-reward");

if (!definition) {
  throw new Error("signup-reward 이벤트 정의를 찾을 수 없습니다.");
}

const registration: ManagedEventCampaign = {
  ...definition,
  id: "event-signup-reward",
  pagePath: "/events/signup-reward",
  targetAudiences: ["guest", "student", "graduate", "staff"],
  isActive: true,
  source: "database",
  createdAt: "2026-07-01T09:00:00+09:00",
  updatedAt: "2026-07-10T09:00:00+09:00",
};

const meta = {
  title: "Domains/Admin/AdminEventDetailView",
  component: AdminEventDetailView,
  args: {
    definition,
    registration,
    state: {
      label: "진행 중",
      className: "border-primary bg-primary text-primary-foreground",
    },
    targetLabel: "게스트 · 교육생 · 수료생 · 운영진",
    message: null,
    registrationAction: async () => {},
    deleteAction: async () => {},
  },
  parameters: {
    nextjs: { appDirectory: true },
    chromatic: { viewports: [360, 820, 1366] },
  },
} satisfies Meta<typeof AdminEventDetailView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ReadOnly: Story = {
  args: {
    canCreate: false,
    canUpdate: false,
    canDelete: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("조회 전용 권한", { exact: true }),
    ).toBeInTheDocument();
    await expect(
      canvas.queryByRole("button", { name: "이벤트 수정" }),
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole("button", { name: "이벤트 삭제" }),
    ).not.toBeInTheDocument();
  },
};
