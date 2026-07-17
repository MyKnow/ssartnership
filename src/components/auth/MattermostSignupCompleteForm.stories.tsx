import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import MattermostSignupCompleteForm from "./MattermostSignupCompleteForm";

const servicePolicy = {
  id: "service-v2",
  kind: "service" as const,
  version: 2,
  title: "싸트너십 서비스 이용약관",
  summary: "서비스 이용 조건",
  content: "서비스 이용약관 본문",
  is_active: true,
  effective_at: "2026-04-18T00:00:00.000Z",
  created_at: null,
  updated_at: null,
};

const privacyPolicy = {
  id: "privacy-v2",
  kind: "privacy" as const,
  version: 2,
  title: "개인정보 처리방침",
  summary: "개인정보 처리 기준",
  content: "개인정보 처리방침 본문",
  is_active: true,
  effective_at: "2026-04-18T00:00:00.000Z",
  created_at: null,
  updated_at: null,
};

const marketingPolicy = {
  id: "marketing-v1",
  kind: "marketing" as const,
  version: 1,
  title: "마케팅 정보 수신 동의",
  summary: "선택적 안내 수신",
  content: "마케팅 정보 수신 동의 본문",
  is_active: true,
  effective_at: "2026-04-18T00:00:00.000Z",
  created_at: null,
  updated_at: null,
};

const meta = {
  title: "Auth/MattermostSignupCompleteForm",
  component: MattermostSignupCompleteForm,
  parameters: {
    viewport: { defaultViewport: "mobile1" },
    chromatic: { viewports: [360, 820, 1366] },
  },
  args: {
    session: {
      mmUserId: "mattermost-user-15",
      mmUsername: "jane4545",
      displayName: "김싸피",
      subjectGeneration: 15,
      senderGeneration: 15,
    },
    requiredPolicies: {
      service: servicePolicy,
      privacy: privacyPolicy,
    },
    marketingPolicy,
    returnTo: "/",
  },
} satisfies Meta<typeof MattermostSignupCompleteForm>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Signup: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("textbox", { name: "MM 아이디" })).toBeDisabled();
    await expect(canvas.getByRole("textbox", { name: "MM 아이디" })).toHaveValue("jane4545");
    await expect(canvas.getByRole("textbox", { name: "이름" })).toBeDisabled();
    await expect(canvas.getByRole("textbox", { name: "이름" })).toHaveValue("김싸피");
    await expect(canvas.getByRole("textbox", { name: "기수" })).toBeDisabled();
    await expect(canvas.getByRole("textbox", { name: "기수" })).toHaveValue("15기");
    await expect(canvas.queryByText("Mattermost 계정 인증 완료 · 15기")).not.toBeInTheDocument();
    await expect(
      canvas.queryByText("Mattermost DM 인증을 완료한 계정으로 싸트너십 계정을 생성합니다."),
    ).not.toBeInTheDocument();

    const submit = canvas.getByRole("button", { name: "모두 동의하고 시작하기" });
    await expect(submit).toBeDisabled();
    await userEvent.type(
      canvas.getByLabelText("사이트 비밀번호"),
      "Password!123",
    );
    await userEvent.type(
      canvas.getByLabelText("비밀번호 확인"),
      "Password!123",
    );
    await expect(submit).toBeEnabled();

    const checkboxes = canvas.getAllByRole("checkbox");
    await checkboxes[0].click();
    await checkboxes[1].click();
    await expect(canvas.getByRole("button", { name: "회원가입하기" })).toBeEnabled();
  },
};
