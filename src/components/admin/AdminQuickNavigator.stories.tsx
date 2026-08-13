import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { act } from "react";
import { expect, userEvent, within } from "storybook/test";
import { ADMIN_NAV_GROUPS } from "./admin-navigation";
import AdminQuickNavigatorProvider, {
  AdminQuickNavigatorTrigger,
} from "./AdminQuickNavigator";

const meta = {
  title: "Domains/Admin/AdminQuickNavigator",
  component: AdminQuickNavigatorProvider,
  args: {
    navGroups: ADMIN_NAV_GROUPS,
    children: <AdminQuickNavigatorTrigger />,
  },
  decorators: [
    (Story) => (
      <div className="p-8">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AdminQuickNavigatorProvider>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SearchAndRestoreFocus: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "빠른 찾기 열기" });
    trigger.focus();
    await userEvent.click(trigger);

    const body = within(document.body);
    await expect(body.getByText("자주 시작하는 업무")).toBeInTheDocument();
    await expect(body.getByRole("option", { name: /작업함/ })).toBeInTheDocument();
    const query = body.getByRole("combobox", { name: "관리 화면 찾기" });
    await expect(query).toHaveFocus();
    await userEvent.type(query, "변경 승인");
    const result = body.getByRole("link", { name: /변경 요청/ });
    await expect(result).toHaveAttribute(
      "href",
      "/admin/partner-requests",
    );
    await expect(body.queryByRole("link", { name: /회원 관리/ })).not.toBeInTheDocument();

    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    const closeButton = body.getByRole("button", { name: "빠른 찾기 닫기" });
    await expect(closeButton).toHaveFocus();
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    await expect(result).toHaveFocus();
    await userEvent.keyboard("{Tab}");
    await expect(closeButton).toHaveFocus();

    await userEvent.click(closeButton);
    await expect(body.queryByRole("dialog")).not.toBeInTheDocument();
    await expect(trigger).toHaveFocus();
  },
};

export const SearchActualTarget: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "빠른 찾기 열기" }),
    );

    const body = within(document.body);
    await userEvent.type(
      body.getByRole("combobox", { name: "관리 화면 찾기" }),
      "르블라썸 강남점",
    );
    await expect(
      body.getByRole("link", { name: /회원·제휴처 검색/ }),
    ).toHaveAttribute("href", "/admin/search?q=%EB%A5%B4%EB%B8%94%EB%9D%BC%EC%8D%B8+%EA%B0%95%EB%82%A8%EC%A0%90");
  },
};

export const KeyboardSelectsResult: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "빠른 찾기 열기" }),
    );

    const body = within(document.body);
    const query = body.getByRole("combobox", { name: "관리 화면 찾기" });
    await userEvent.type(query, "변경 승인");
    await userEvent.keyboard("{ArrowDown}");

    const result = body.getByRole("option", { name: /변경 요청/ });
    await expect(result).toHaveAttribute("aria-selected", "true");
    await expect(query).toHaveAttribute(
      "aria-activedescendant",
      result.getAttribute("id") ?? "",
    );

    await act(async () => {
      await userEvent.keyboard("{Enter}");
    });
    await expect(body.queryByRole("dialog")).not.toBeInTheDocument();
  },
};
