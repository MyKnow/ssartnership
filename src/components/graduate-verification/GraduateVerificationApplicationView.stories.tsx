import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import GraduateVerificationApplicationView from "./GraduateVerificationApplicationView";

const meta = {
  title: "Screens/Auth/GraduateVerificationApplication",
  component: GraduateVerificationApplicationView,
  parameters: {
    nextjs: { appDirectory: true },
    chromatic: { viewports: [360, 430, 820, 1366] },
  },
  beforeEach: ({ parameters }) => {
    const originalFetch = window.fetch;
    window.fetch = async (input) => {
      const url = String(input);
      if (url.includes("/api/graduate-verification/email/send")) {
        if (parameters.emailDeliveryError) {
          return Response.json({ message: "인증 코드를 보내지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 503 });
        }
        return Response.json({ expiresInSeconds: parameters.codeExpired ? 0.001 : 300 });
      }
      if (url.includes("/api/graduate-verification/current")) {
        if (parameters.educationResubmission) {
          return Response.json({ request: { status: "needs_resubmission", resubmission_targets: ["education_period"], legal_name: "테스트 수료생", inferred_generation: 15, campus: "서울", review_note: "기수를 확인해 주세요." } });
        }
        if (parameters.fileOnlyResubmission) {
          return Response.json({ request: { status: "needs_resubmission", resubmission_targets: ["certificate"], legal_name: "테스트 수료생", inferred_generation: 15, campus: "서울" } });
        }
        return parameters.reviewPending
          ? Response.json({ request: { status: "submitted" } })
          : new Response("{}", { status: 404 });
      }
      return Response.json({});
    };
    return () => { window.fetch = originalFetch; };
  },
} satisfies Meta<typeof GraduateVerificationApplicationView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmailVerification: Story = {};

export const ExistingMemberRecovery: Story = {
  args: { requestKind: "existing_member_recovery" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const application = canvas.getByTestId("graduate-verification-application");
    await expect(canvas.getByRole("heading", { name: "기존 회원 복구" })).toBeVisible();
    await expect(application.getBoundingClientRect().width).toBeLessThanOrEqual(640);
    const steps = canvas.getByRole("list", { name: "계정 복구 단계" });
    await expect(within(steps).getAllByRole("listitem")[0]).toHaveAttribute("aria-current", "step");
    const input = canvas.getByRole("textbox", { name: /^이메일$/ });
    const action = canvas.getByRole("button", { name: "인증 코드 보내기" });
    await expect(action.getBoundingClientRect().width).toBe(input.getBoundingClientRect().width);
    await expect(within(steps).getByText("이메일 인증").getBoundingClientRect().left).toBe(input.getBoundingClientRect().left);
    await expect(within(steps).getByText("파일 제출").getBoundingClientRect().right).toBe(input.getBoundingClientRect().right);
    await expect(canvas.queryByText("다음 단계 준비물")).not.toBeInTheDocument();
  },
};

async function sendEmailCode(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await userEvent.type(
    canvas.getByRole("textbox", { name: "이메일" }),
    "graduate@example.com",
  );
  await userEvent.click(canvas.getByRole("button", { name: "인증 코드 보내기" }));
  return canvas;
}

async function verifyEmail(canvasElement: HTMLElement) {
  const canvas = await sendEmailCode(canvasElement);
  await userEvent.type(canvas.getByRole("textbox", { name: "6자리 인증 코드" }), "123456");
  await userEvent.click(canvas.getByRole("button", { name: "이메일 인증하기" }));
  return canvas;
}

async function moveToDetails(canvasElement: HTMLElement) {
  const canvas = await verifyEmail(canvasElement);
  await expect(canvas.getByRole("heading", { name: "교육 정보를 입력해 주세요" })).toBeInTheDocument();
  const steps = canvas.getAllByRole("listitem");
  await expect(steps[0]).toHaveTextContent("이메일 인증 완료");
  await expect(steps[0]).not.toHaveAttribute("aria-current");
  await expect(steps[1]).toHaveAttribute("aria-current", "step");
  return canvas;
}

export const RecoveryCodeSent: Story = {
  args: { requestKind: "existing_member_recovery" },
  play: async ({ canvasElement }) => {
    const canvas = await sendEmailCode(canvasElement);
    await expect(canvas.getByRole("textbox", { name: "6자리 인증 코드" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "이메일 인증하기" })).toBeEnabled();
    await expect(canvas.getByRole("button", { name: "인증 코드 다시 보내기" })).toBeEnabled();
  },
};

export const RecoveryDeliveryError: Story = {
  args: { requestKind: "existing_member_recovery" },
  parameters: { emailDeliveryError: true },
  play: async ({ canvasElement }) => {
    const canvas = await sendEmailCode(canvasElement);
    await expect(canvas.getByText("인증 코드를 보내지 못했습니다. 잠시 후 다시 시도해 주세요.")).toBeVisible();
    await expect(canvas.getByRole("textbox", { name: /^이메일$/ })).toHaveValue("graduate@example.com");
    await expect(canvas.getByRole("button", { name: "인증 코드 보내기" })).toBeEnabled();
  },
};

export const RecoveryExpiredCode: Story = {
  args: { requestKind: "existing_member_recovery" },
  parameters: { codeExpired: true },
  play: async ({ canvasElement }) => {
    const canvas = await sendEmailCode(canvasElement);
    await expect(await canvas.findByText("인증 코드가 만료되었습니다. 다시 보내 주세요.", {}, { timeout: 2_000 })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "이메일 인증하기" })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "인증 코드 다시 보내기" })).toBeEnabled();
  },
};

async function expectCohortSelectionDetails(canvasElement: HTMLElement) {
  const canvas = await moveToDetails(canvasElement);
  await expect(canvas.getByRole("combobox", { name: "기수" })).toHaveValue("");
  await expect(canvas.queryByRole("textbox", { name: "교육 시작 연도" })).not.toBeInTheDocument();
  await expect(canvas.queryByRole("combobox", { name: "교육 시작 월" })).not.toBeInTheDocument();
  await expect(canvas.queryByRole("textbox", { name: "교육 종료 연도" })).not.toBeInTheDocument();
  await expect(canvas.queryByRole("combobox", { name: "교육 종료 월" })).not.toBeInTheDocument();
}

export const EducationDetails: Story = {
  play: async ({ canvasElement }) => {
    await expectCohortSelectionDetails(canvasElement);
  },
};

export const RecoveryEducationDetails: Story = {
  ...EducationDetails,
  args: { requestKind: "existing_member_recovery" },
  play: async ({ canvasElement }) => {
    await expectCohortSelectionDetails(canvasElement);
  },
};

export const FileSubmission: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = await moveToDetails(canvasElement);
    await userEvent.type(canvas.getByRole("textbox", { name: "이름" }), "테스트 수료생");
    await userEvent.selectOptions(canvas.getByRole("combobox", { name: "기수" }), "15");
    await userEvent.selectOptions(canvas.getByRole("combobox", { name: "캠퍼스" }), "서울");
    await userEvent.click(canvas.getByRole("button", { name: "다음" }));
    await expect(canvas.getByRole("heading", { name: "교육이수증과 본인 사진" })).toBeInTheDocument();
    await expect(canvas.getByText("PDF(최대 10MB)")).toBeInTheDocument();
    await expect(canvas.getByText("얼굴이 분명하게 보이는 사진(최대 5MB)")).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: args.requestKind === "existing_member_recovery" ? "복구 신청 제출" : "수료생 인증 제출" })).toBeDisabled();
    await expect(canvas.getAllByRole("listitem")[2]).toHaveAttribute("aria-current", "step");
    await expect(canvas.queryByText("사진은 공개 URL로 제공하지 않습니다.")).not.toBeInTheDocument();
  },
};

export const RecoveryFileSubmission: Story = {
  ...FileSubmission,
  args: { requestKind: "existing_member_recovery" },
};

export const RecoveryCohortRequired: Story = {
  args: { requestKind: "existing_member_recovery" },
  play: async ({ canvasElement }) => {
    const canvas = await moveToDetails(canvasElement);
    await userEvent.type(canvas.getByRole("textbox", { name: "이름" }), "테스트 수료생");
    await userEvent.selectOptions(canvas.getByRole("combobox", { name: "캠퍼스" }), "서울");
    await userEvent.click(canvas.getByRole("button", { name: "다음" }));
    const generation = canvas.getByRole("combobox", { name: "기수" });
    await expect(canvas.getByText("기수를 선택해 주세요.")).toBeVisible();
    await expect(generation).toHaveAttribute("aria-invalid", "true");
    await expect(generation).toHaveFocus();
    await userEvent.selectOptions(generation, "15");
    await expect(generation).not.toHaveAttribute("aria-invalid", "true");
    await userEvent.click(canvas.getByRole("button", { name: "다음" }));
    await expect(canvas.getByRole("heading", { name: "교육이수증과 본인 사진" })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "이전" }));
    await expect(canvas.getByRole("combobox", { name: "기수" })).toHaveValue("15");
  },
};

export const CohortRequired: Story = {
  ...RecoveryCohortRequired,
};

export const EducationInfoResubmission: Story = {
  parameters: { educationResubmission: true },
  play: async ({ canvasElement }) => {
    const canvas = await moveToDetails(canvasElement);
    await expect(canvas.getByRole("combobox", { name: "기수" })).toHaveValue("15");
    await expect(canvas.getByRole("combobox", { name: "기수" })).toBeEnabled();
  },
};

export const FileOnlyResubmissionLocksEducation: Story = {
  parameters: { fileOnlyResubmission: true },
  play: async ({ canvasElement }) => {
    const canvas = await moveToDetails(canvasElement);
    await expect(canvas.getByRole("combobox", { name: "기수" })).toBeDisabled();
    await expect(canvas.getByRole("textbox", { name: "이름" })).toBeDisabled();
    await expect(canvas.getByRole("combobox", { name: "캠퍼스" })).toBeDisabled();
  },
};

export const RecoveryReviewPending: Story = {
  args: { requestKind: "existing_member_recovery" },
  parameters: { reviewPending: true },
  play: async ({ canvasElement }) => {
    const canvas = await verifyEmail(canvasElement);
    await expect(canvas.getByRole("button", { name: "신청 철회" })).toBeVisible();
    await expect(canvas.queryByRole("list", { name: "계정 복구 단계" })).not.toBeInTheDocument();
  },
};
