import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import AdminOperationFlow from "./AdminOperationFlow";

const meta = {
  title: "Domains/Admin/AdminOperationFlow",
  component: AdminOperationFlow,
} satisfies Meta<typeof AdminOperationFlow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const CurrentStep: Story = {
  args: {
    steps: [
      { label: "대상·작성", description: "수신 범위와 문구를 정리합니다.", state: "complete", href: "/admin/push?tab=send" },
      { label: "검토", description: "발송 가능 대상과 채널을 확인합니다.", state: "current" },
      { label: "결과", description: "성공·실패 로그를 확인합니다.", state: "upcoming", href: "/admin/push?tab=logs" },
    ],
  },
};

export const Upcoming: Story = {
  args: {
    steps: [
      { label: "수신함", description: "운영 알림을 확인합니다.", state: "current", href: "/admin/notifications" },
      { label: "작성", description: "다음 운영 작업으로 이동합니다.", state: "upcoming", href: "/admin/push?tab=send" },
      { label: "결과", description: "처리 결과를 확인합니다.", state: "upcoming", href: "/admin/push?tab=logs" },
    ],
  },
};
