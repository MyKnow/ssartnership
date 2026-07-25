import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import AdminWorkspaceSummary from "./AdminWorkspaceSummary";

const meta = {
  title: "Domains/Admin/AdminWorkspaceSummary",
  component: AdminWorkspaceSummary,
  args: {
    eyebrow: "Create workspace",
    title: "생성 전 확인",
    description:
      "필수 분류와 연결 대상을 확인한 뒤, 제휴처 정보를 한 번 검토하고 저장합니다.",
    items: [
      {
        label: "카테고리",
        value: "12개",
        detail: "선택 가능한 분류",
      },
      {
        label: "파트너사",
        value: "8개",
        detail: "연결 가능한 계약 회사",
      },
      {
        label: "저장 방식",
        value: "1회 검토 후 추가",
        detail: "파일 입력도 최종 폼에서 확인",
      },
    ],
  },
  parameters: {
    chromatic: { viewports: [360, 820, 1366] },
  },
} satisfies Meta<typeof AdminWorkspaceSummary>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongKoreanLabels: Story = {
  args: {
    title: "저장 전에 운영자가 확인해야 할 긴 설명도 줄바꿈되어야 합니다",
    items: [
      {
        label: "카테고리 선택 가능 범위",
        value: "서울 캠퍼스 전체",
        detail: "권한과 캠퍼스 범위에 따라 표시됩니다.",
      },
      {
        label: "파일 입력 상태",
        value: "검토 필요",
        detail: "반영된 값을 확인한 뒤 최종 저장을 진행합니다.",
      },
    ],
  },
};
