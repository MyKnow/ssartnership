import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
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

function installMattermostCodeIssueFetchMock() {
  window.fetch = async (input) => {
    if (String(input).includes("/api/mm/code/issue")) {
      return Response.json(
        {
          ok: true,
          challenge: "storybook-mattermost-code-challenge",
          expiresInSeconds: 300,
          retryAfterSeconds: 60,
        },
        { status: 202 },
      );
    }
    return Response.json({ ok: true });
  };
}

export const CodeIssued: Story = {
  play: async ({ canvasElement }) => {
    installMattermostCodeIssueFetchMock();
    const canvas = within(canvasElement);

    await userEvent.type(canvas.getByRole("textbox", { name: "Mattermost ID" }), "myknow");
    await userEvent.selectOptions(canvas.getByRole("combobox", { name: "기수" }), "15");
    await userEvent.click(canvas.getByRole("button", { name: "Mattermost DM으로 코드 받기" }));

    await expect(
      canvas.getByText("입력한 Mattermost 계정으로 인증 코드를 보냈습니다."),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole("timer", { name: "인증 코드 만료까지 05:00 남음" }),
    ).toHaveTextContent("05:00");
    await expect(canvas.getByRole("textbox", { name: "6자리 인증 코드" })).toHaveAttribute(
      "aria-describedby",
    );
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
