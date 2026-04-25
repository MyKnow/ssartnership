import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import AdminMobileNav from "./AdminMobileNav";

const meta = {
  title: "Domains/Admin/AdminMobileNav",
  component: AdminMobileNav,
  args: {
    title: "관리 대시보드",
    description: "모바일 환경에서 관리자 주요 화면으로 이동합니다.",
    backHref: "/admin/partners",
    backLabel: "브랜드 관리",
    logoutAction: async () => {},
  },
  decorators: [
    (Story) => (
      <div className="w-fit">
        <Story />
      </div>
    ),
  ],
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
} satisfies Meta<typeof AdminMobileNav>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutBackLink: Story = {
  args: {
    backHref: undefined,
    backLabel: undefined,
  },
};
