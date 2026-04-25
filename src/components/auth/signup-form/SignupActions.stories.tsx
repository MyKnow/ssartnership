import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import SignupActions from "./SignupActions";
import type { SignupStep as SignupStepType } from "./types";

function SignupActionsDemo({
  initialStep = "auth",
  initialCodeRequested = false,
  pending = false,
}: {
  initialStep?: SignupStepType;
  initialCodeRequested?: boolean;
  pending?: boolean;
}) {
  const [step, setStep] = useState<SignupStepType>(initialStep);
  const [codeRequested, setCodeRequested] = useState(initialCodeRequested);

  return (
    <div className="mx-auto max-w-sm rounded-2xl border border-border bg-surface p-4">
      <SignupActions
        step={step}
        codeRequested={codeRequested}
        requestCodeLabel="인증 번호 요청"
        pending={pending}
        onRequestCode={() => setCodeRequested(true)}
        onNext={() => setStep("signup")}
        onSubmitSignup={fn()}
        onResetToRequest={() => setCodeRequested(false)}
        onResetToAuth={() => setStep("auth")}
      />
    </div>
  );
}

function SignupActionsStory(props: {
  step?: SignupStepType;
  codeRequested?: boolean;
  pending?: boolean;
}) {
  return (
    <SignupActionsDemo
      initialStep={props.step}
      initialCodeRequested={props.codeRequested}
      pending={props.pending}
    />
  );
}

const meta = {
  title: "Domains/Auth/SignupActions",
  component: SignupActionsStory,
  args: {
    step: "auth",
    codeRequested: false,
    pending: false,
  },
} satisfies Meta<typeof SignupActions>;

export default meta;

type Story = StoryObj<typeof meta>;

export const RequestCode: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "인증 번호 요청" }));
    await expect(canvas.getByRole("button", { name: "다음" })).toBeInTheDocument();
  },
};

export const AuthReady: Story = {
  args: {
    codeRequested: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "다음" }));
    await expect(canvas.getByRole("button", { name: "회원가입" })).toBeInTheDocument();
  },
};

export const SignupStep: Story = {
  args: {
    step: "signup",
    codeRequested: true,
  },
};
