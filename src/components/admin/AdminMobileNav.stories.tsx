import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import AdminMobileNav from "./AdminMobileNav";

const meta = {
  title: "Domains/Admin/AdminMobileNav",
  component: AdminMobileNav,
  args: {
    title: "관리 대시보드",
    description: "모바일 환경에서 관리자 주요 화면으로 이동합니다.",
    backHref: "/admin/partners",
    backLabel: "브랜드 관리",
    logoutAction: fn(),
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

export const OpenAndClose: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "관리 메뉴 열기" }));

    const body = within(document.body);
    await expect(body.getByRole("dialog")).toBeInTheDocument();
    await expect(body.getByText("관리 대시보드")).toBeInTheDocument();
    await expect(body.getByRole("link", { name: "관리 홈" })).toHaveAttribute("href", "/admin");
    const partnerLinks = body.getAllByRole("link", { name: "브랜드 관리" });
    await expect(partnerLinks[0]!).toHaveAttribute("href", "/admin/partners");
    await expect(body.getByRole("link", { name: "사용자 화면" })).toHaveAttribute("href", "/");
    await expect(body.getByRole("button", { name: "로그아웃" })).toBeInTheDocument();

    await userEvent.click(body.getAllByRole("button", { name: "관리 메뉴 닫기" })[0]!);
    await expect(body.queryByRole("dialog")).not.toBeInTheDocument();
  },
};

export const EscapeClose: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "관리 메뉴 열기" }));

    const body = within(document.body);
    await expect(body.getByRole("dialog")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await expect(body.queryByRole("dialog")).not.toBeInTheDocument();
  },
};

export const WithoutBackLink: Story = {
  args: {
    backHref: undefined,
    backLabel: undefined,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "관리 메뉴 열기" }));

    const body = within(document.body);
    await expect(body.queryByRole("link", { name: "브랜드 관리" })).toBeInTheDocument();
    await expect(body.getByRole("link", { name: "사용자 화면" })).toBeInTheDocument();
  },
};
