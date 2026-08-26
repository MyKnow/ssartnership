import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import Button from "./Button";
import { ToastProvider, useToast } from "./Toast";

function ToastDemo() {
  const { notify } = useToast();

  return (
    <Button type="button" onClick={() => notify("공유 링크가 복사되었습니다.")}>
      토스트 열기
    </Button>
  );
}

const meta = {
  title: "UI/Toast",
  component: ToastDemo,
  render: () => (
    <ToastProvider>
      <ToastDemo />
    </ToastProvider>
  ),
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
} satisfies Meta<typeof ToastDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Visible: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "토스트 열기" }));
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "공유 링크가 복사되었습니다.",
    );
  },
};

export const Dismissible: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "토스트 열기" }));

    const status = canvas.getByRole("status");
    const toast = status.closest<HTMLElement>("[data-toast-item]");
    await expect(toast).not.toBeNull();
    await expect(toast).toHaveClass("ui-toast-glass");
    const toastStyle = getComputedStyle(toast!);
    await expect(toastStyle.backdropFilter).toContain("blur(24px)");
    await expect(toastStyle.backdropFilter).toContain("saturate(1.8)");
    const dismissButton = within(toast!).getByRole("button", {
      name: "알림 닫기",
    });
    await expect(status).toHaveTextContent("공유 링크가 복사되었습니다.");
    await expect(dismissButton).toBeVisible();
    await expect(dismissButton).toHaveClass("h-11", "w-11");

    await userEvent.click(dismissButton);
    await waitFor(() =>
      expect(canvas.queryByRole("status")).not.toBeInTheDocument(),
    );
  },
};
