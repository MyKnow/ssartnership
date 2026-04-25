import { useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import SignupPasswordFields from "./SignupPasswordFields";

function SignupPasswordFieldsDemo({
  pending = false,
  passwordError,
  passwordConfirmError,
}: {
  pending?: boolean;
  passwordError?: string;
  passwordConfirmError?: string;
}) {
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const passwordRef = useRef<HTMLInputElement>(null);
  const passwordConfirmRef = useRef<HTMLInputElement>(null);

  return (
    <div className="mx-auto max-w-xl">
      <SignupPasswordFields
        password={password}
        passwordConfirm={passwordConfirm}
        passwordError={passwordError}
        passwordConfirmError={passwordConfirmError}
        passwordRef={passwordRef}
        passwordConfirmRef={passwordConfirmRef}
        pending={pending}
        onPasswordChange={setPassword}
        onPasswordConfirmChange={setPasswordConfirm}
        onGeneratePassword={() => {
          const generated = "Demo!2345";
          setPassword(generated);
          setPasswordConfirm(generated);
        }}
      />
    </div>
  );
}

function SignupPasswordFieldsStory(props: {
  pending?: boolean;
  passwordError?: string;
  passwordConfirmError?: string;
}) {
  return (
    <SignupPasswordFieldsDemo
      pending={props.pending}
      passwordError={props.passwordError}
      passwordConfirmError={props.passwordConfirmError}
    />
  );
}

const meta = {
  title: "Domains/Auth/SignupPasswordFields",
  component: SignupPasswordFieldsStory,
  args: {
    pending: false,
  },
} satisfies Meta<typeof SignupPasswordFields>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText("랜덤 생성"));
    await expect(canvas.getByPlaceholderText("영문/숫자/특수문자 포함 8자 이상")).toHaveValue("Demo!2345");
    await expect(canvas.getByPlaceholderText("다시 입력해 주세요")).toHaveValue("Demo!2345");
  },
};

export const WithErrors: Story = {
  args: {
    passwordError: "비밀번호 정책을 만족하지 않습니다.",
    passwordConfirmError: "비밀번호가 일치하지 않습니다.",
  },
};
