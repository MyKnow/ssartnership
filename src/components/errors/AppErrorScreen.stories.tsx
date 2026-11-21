import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import AppErrorScreen from "./AppErrorScreen";

const meta = {
  title: "Feedback/AppErrorScreen",
  component: AppErrorScreen,
  args: {
    code: "500",
    title: "화면을 불러오지 못했습니다",
    description:
      "일시적인 문제로 이 화면을 표시하지 못했습니다. 다시 시도하거나 홈으로 이동해 주세요.",
    digest: "1234567890",
    onRetry: () => undefined,
  },
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/partners/missing" },
    },
  },
} satisfies Meta<typeof AppErrorScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Page: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("main")).toHaveAttribute(
      "data-app-error-layout",
      "page",
    );
  },
};

export const EmbeddedInSiteShell: Story = {
  args: { layout: "embedded" },
  decorators: [
    (Story) => (
      <div className="flex min-h-screen flex-col bg-background">
        <main className="flex-1">
          <Story />
        </main>
        <footer className="border-t border-border px-4 py-6 text-sm text-muted-foreground">
          공용 Footer 자리
        </footer>
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole("main")).toHaveLength(1);
    await expect(canvas.getByText("공용 Footer 자리")).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "다시 시도" }),
    ).toBeVisible();
  },
};

export const EmbeddedInPartnerShell: Story = {
  args: {
    layout: "embedded",
    title: "파트너 화면을 불러오지 못했습니다",
    description:
      "일시적인 문제로 이 화면을 표시하지 못했습니다. 다시 시도하거나 파트너 홈으로 이동해 주세요.",
  },
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/partner/companies/mock-company" },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("main")).toBeNull();
    await expect(canvas.getByRole("link", { name: "파트너 홈" })).toHaveAttribute(
      "href",
      "/partner",
    );
  },
};
