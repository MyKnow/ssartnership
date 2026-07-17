import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import MattermostCodeVerificationForm from "./MattermostCodeVerificationForm";

const meta = {
  title: "Auth/MattermostCodeVerificationForm",
  component: MattermostCodeVerificationForm,
  parameters: {
    viewport: { defaultViewport: "mobile1" },
    chromatic: { viewports: [360, 820, 1366] },
  },
  args: {
    activeSenderGenerations: [15],
    purpose: "signup",
    returnTo: "/",
  },
} satisfies Meta<typeof MattermostCodeVerificationForm>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Signup: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const generation = canvas.getByRole("combobox", { name: "기수" });
    const options = within(generation).getAllByRole("option");

    await expect(canvas.getByPlaceholderText("예: myknow")).toBeVisible();
    await expect(
      canvas.queryByText("기수의 Mattermost Sender가 6자리 인증 코드를 DM으로 보냅니다."),
    ).not.toBeInTheDocument();
    await expect(generation).toHaveValue("");
    await expect(options).toHaveLength(4);
    await expect(options[0]).toHaveTextContent("기수를 선택해 주세요");
    await expect(options[1]).toHaveTextContent("운영진");
    await expect(options[2]).toHaveTextContent(/^\d+기$/);
    await expect(options[3]).toHaveTextContent(/^\d+기\(예정\)$/);
    await expect(options[1]).not.toBeDisabled();
    await expect(options[2]).not.toBeDisabled();
    await expect(options[3]).toBeDisabled();
  },
};

export const NoActiveSenders: Story = {
  args: {
    activeSenderGenerations: [],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const generation = canvas.getByRole("combobox", { name: "기수" });
    const options = within(generation).getAllByRole("option");

    await expect(options[1]).toHaveTextContent("운영진(예정)");
    await expect(options[1]).toBeDisabled();
    await expect(options[2]).toHaveTextContent(/^\d+기\(예정\)$/);
    await expect(options[2]).toBeDisabled();
    await expect(options[3]).toHaveTextContent(/^\d+기\(예정\)$/);
    await expect(options[3]).toBeDisabled();
  },
};
