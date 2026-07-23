import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import Button from "@/components/ui/Button";
import AdminStatePanel from "./AdminStatePanel";

const meta = {
  title: "Domains/Admin/AdminStatePanel",
  component: AdminStatePanel,
  args: {
    kind: "empty",
    title: "확인할 요청이 없습니다.",
    description: "새 요청이 도착하면 이 영역에서 바로 검토할 수 있습니다.",
    action: <Button href="/admin/partners" variant="secondary">제휴처 목록 보기</Button>,
  },
} satisfies Meta<typeof AdminStatePanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Error: Story = {
  args: {
    kind: "error",
    title: "목록을 불러오지 못했습니다.",
    description: "잠시 후 다시 확인해 주세요. 문제가 계속되면 운영 담당자에게 알려 주세요.",
    action: <Button href="/admin/partners" variant="secondary">다시 확인</Button>,
  },
};

export const Forbidden: Story = {
  args: {
    kind: "forbidden",
    title: "이 관리 화면을 볼 권한이 없습니다.",
    description: "필요한 권한은 최고 관리자에게 요청해 주세요.",
  },
};
