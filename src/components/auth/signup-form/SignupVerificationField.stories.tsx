import { useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import SignupVerificationField from "./SignupVerificationField";

function SignupVerificationFieldDemo({
  initialCode = "",
  error,
}: {
  initialCode?: string;
  error?: string;
}) {
  const [code, setCode] = useState(initialCode);
  const codeRef = useRef<HTMLInputElement>(null);

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-border bg-surface p-4">
      <SignupVerificationField
        code={code}
        error={error}
        codeRef={codeRef}
        onCodeChange={setCode}
      />
    </div>
  );
}

function SignupVerificationFieldStory(props: {
  code?: string;
  error?: string;
}) {
  return <SignupVerificationFieldDemo initialCode={props.code} error={props.error} />;
}

const meta = {
  title: "Domains/Auth/SignupVerificationField",
  component: SignupVerificationFieldStory,
  args: {
    code: "",
  },
} satisfies Meta<typeof SignupVerificationField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText("인증 번호");
    await userEvent.type(input, "123456");
    await expect(input).toHaveValue("123456");
  },
};

export const WithError: Story = {
  args: {
    error: "인증 번호를 다시 확인해 주세요.",
  },
};
