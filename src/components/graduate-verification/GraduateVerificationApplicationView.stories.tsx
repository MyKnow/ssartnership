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
} satisfies Meta<typeof GraduateVerificationApplicationView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmailVerification: Story = {};

function installGraduateVerificationFetchMock() {
  window.fetch = async (input) => {
    const url = String(input);
    if (url.includes("/api/graduate-verification/email/send")) {
      return Response.json({ expiresInSeconds: 300 });
    }
    if (url.includes("/api/graduate-verification/email/verify")) {
      return Response.json({});
    }
    if (url.includes("/api/graduate-verification/current")) {
      return new Response("{}", { status: 404 });
    }
    return Response.json({});
  };
}

async function moveToDetails(canvasElement: HTMLElement) {
  installGraduateVerificationFetchMock();
  const canvas = within(canvasElement);
  await userEvent.type(
    canvas.getByRole("textbox", { name: "이메일" }),
    "graduate@example.com",
  );
  await userEvent.click(canvas.getByRole("button", { name: "인증 코드 보내기" }));
  await userEvent.type(canvas.getByRole("textbox", { name: "6자리 인증 코드" }), "123456");
  await userEvent.click(canvas.getByRole("button", { name: "이메일 인증하기" }));
  await expect(canvas.getByRole("heading", { name: "2. 교육 정보" })).toBeInTheDocument();
  return canvas;
}

export const EducationDetails: Story = {
  play: async ({ canvasElement }) => {
    const canvas = await moveToDetails(canvasElement);
    await expect(
      canvas.queryByText("이메일 인증이 완료되었습니다. 교육 정보를 입력해 주세요."),
    ).not.toBeInTheDocument();
    await expect(canvas.queryByText("자동 계산된 15기")).not.toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "다음" })).toBeInTheDocument();
  },
};

export const FileSubmission: Story = {
  play: async ({ canvasElement }) => {
    const canvas = await moveToDetails(canvasElement);
    await userEvent.type(canvas.getByRole("textbox", { name: "이름" }), "테스트 수료생");
    await userEvent.selectOptions(canvas.getByRole("combobox", { name: "교육 시작 월" }), "1");
    await userEvent.selectOptions(canvas.getByRole("combobox", { name: "교육 종료 월" }), "6");
    await userEvent.selectOptions(canvas.getByRole("combobox", { name: "캠퍼스" }), "서울");
    await userEvent.click(canvas.getByRole("button", { name: "다음" }));
    await expect(canvas.getByRole("heading", { name: "3. 교육이수증과 본인 사진" })).toBeInTheDocument();
    await expect(canvas.getByText("PDF(최대 10MB)")).toBeInTheDocument();
    await expect(canvas.getByText("얼굴이 분명하게 보이는 사진(최대 5MB)")).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "제출" })).toBeDisabled();
    await expect(canvas.queryByText("사진은 공개 URL로 제공하지 않습니다.")).not.toBeInTheDocument();
  },
};
