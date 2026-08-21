import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import Button from "@/components/ui/Button";
import AdminConfirmDialog from "./AdminConfirmDialog";

function ConfirmDialogDemo() {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-64 p-6">
      <Button variant="danger" onClick={() => setOpen(true)}>
        삭제 확인 열기
      </Button>
      <AdminConfirmDialog
        open={open}
        title="발송 로그 삭제"
        description="선택한 발송 로그를 삭제합니다. 삭제 후에는 관리자 화면에서 다시 확인할 수 없습니다."
        confirmLabel="로그 삭제"
        danger
        onClose={() => setOpen(false)}
        onConfirm={() => setOpen(false)}
      />
    </div>
  );
}

const meta = {
  title: "Domains/Admin/AdminConfirmDialog",
  component: ConfirmDialogDemo,
} satisfies Meta<typeof ConfirmDialogDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "삭제 확인 열기" });
    await userEvent.click(trigger);

    const body = within(document.body);
    const dialog = body.getByRole("dialog", { name: "발송 로그 삭제" });
    await expect(dialog).toBeInTheDocument();
    await waitFor(() =>
      expect(body.getByRole("button", { name: "모달 닫기" })).toHaveFocus(),
    );
    await userEvent.keyboard("{Escape}");
    await expect(body.queryByRole("dialog", { name: "발송 로그 삭제" })).not.toBeInTheDocument();
    await expect(trigger).toHaveFocus();
  },
};
