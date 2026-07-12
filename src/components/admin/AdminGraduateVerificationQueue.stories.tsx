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
        completion_stage: "semester_1",
        education_start_year: 2026,
        education_start_month: 1,
        education_end_year: 2026,
        education_end_month: 6,
        inferred_cohort: 15,
        campus: "서울",
        status: "submitted",
        profile_image_id: "00000000-0000-4000-8000-000000000102",
        created_at: "2026-07-12T00:00:00.000Z",
      },
    ],
    photoReplacements: [
      {
        id: "00000000-0000-4000-8000-000000000103",
        member_id: "00000000-0000-4000-8000-000000000104",
        created_at: "2026-07-12T00:00:00.000Z",
        member: { display_name: "합성 수료생 회원", year: 15 },
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
      approvePhoto: noop,
      rejectPhoto: noop,
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
  args: { requests: [], photoReplacements: [], setupEmailRetries: [] },
};
