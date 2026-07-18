import { expect, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import AdminGraduateVerificationQueue from "./AdminGraduateVerificationQueue";

const noop = async () => undefined;

const meta = {
  title: "Domains/Admin/GraduateVerificationQueue",
  component: AdminGraduateVerificationQueue,
  args: {
    requests: [
      {
        id: "00000000-0000-4000-8000-000000000101",
        email: "graduate@example.com",
        legal_name: "합성 수료생 신청자",
        education_start_year: 2026,
        education_start_month: 1,
        education_end_year: 2026,
        education_end_month: 6,
        inferred_generation: 15,
        campus: "서울",
        request_kind: "graduate_signup",
        recovery_member_id: null,
        status: "submitted",
        profile_image_id: "00000000-0000-4000-8000-000000000102",
        created_at: "2026-07-12T00:00:00.000Z",
      },
    ],
    setupEmailRetries: [
      {
        id: "00000000-0000-4000-8000-000000000105",
        email: "delivery-failed@example.com",
        legal_name: "메일 재발송 대상",
        setup_email_last_error_at: "2026-07-12T00:00:00.000Z",
      },
    ],
    actions: {
      startReview: noop,
      requestResubmission: noop,
      approveRequest: noop,
      rejectRequest: noop,
      resendSetupEmail: noop,
    },
  },
  parameters: {
    nextjs: { appDirectory: true },
    chromatic: { viewports: [360, 430, 820, 1366] },
  },
} satisfies Meta<typeof AdminGraduateVerificationQueue>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: { requests: [], setupEmailRetries: [] },
};

export const MediaViewer: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(document.body);

    await expect(canvas.getByRole("button", { name: "수료증 보기" })).toBeInTheDocument();
    await expect(canvas.queryByRole("link", { name: "수료증 보기" })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "사진 보기" }));
    await expect(body.getByRole("dialog", { name: "본인 사진 미리보기" })).toBeInTheDocument();
    await userEvent.click(body.getByRole("button", { name: "닫기" }));
    await expect(body.queryByRole("dialog", { name: "본인 사진 미리보기" })).not.toBeInTheDocument();
  },
};
