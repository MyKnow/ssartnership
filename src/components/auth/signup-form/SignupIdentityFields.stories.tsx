import { useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import SignupIdentityFields from "./SignupIdentityFields";

function SignupIdentityFieldsDemo({
  locked = false,
  usernameError,
  yearError,
  onYearChange = fn(),
  onUsernameChange = fn(),
}: {
  locked?: boolean;
  usernameError?: string;
  yearError?: string;
  onYearChange?: (value: string) => void;
  onUsernameChange?: (value: string) => void;
}) {
  const [username, setUsername] = useState("");
  const [year, setYear] = useState("");
  const usernameRef = useRef<HTMLInputElement>(null);
  const yearGroupRef = useRef<HTMLDivElement>(null);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <SignupIdentityFields
        username={username}
        year={year}
        locked={locked}
        signupYears={[15, 14, 0]}
        usernameError={usernameError}
        yearError={yearError}
        usernameRef={usernameRef}
        yearGroupRef={yearGroupRef}
        onUsernameChange={(value) => {
          setUsername(value);
          onUsernameChange(value);
        }}
        onYearChange={(value) => {
          setYear(value);
          onYearChange(value);
        }}
      />
    </div>
  );
}

const meta = {
  title: "Domains/Auth/SignupIdentityFields",
  component: SignupIdentityFieldsDemo,
  args: {
    locked: false,
    usernameError: undefined,
    yearError: undefined,
    onYearChange: fn(),
    onUsernameChange: fn(),
  },
} satisfies Meta<typeof SignupIdentityFieldsDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText("15기"));
    await userEvent.type(canvas.getByPlaceholderText("예시: myknow"), "myknow");

    await expect(args.onYearChange).toHaveBeenCalledWith("15");
    await expect(args.onUsernameChange).toHaveBeenCalledWith("myknow");
    await expect(args.onYearChange).toHaveBeenCalledTimes(1);
  },
};

export const LockedWithErrors: Story = {
  args: {
    locked: true,
    usernameError: "MM 아이디를 입력해 주세요.",
    yearError: "기수를 선택해 주세요.",
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("MM 아이디를 입력해 주세요.")).toBeInTheDocument();
    await expect(canvas.getByText("기수를 선택해 주세요.")).toBeInTheDocument();

    const yearButton = canvas.getByText("14기").closest("button");
    await expect(yearButton).not.toBeNull();
    await expect(yearButton).toBeDisabled();
    await userEvent.click(yearButton!);
    await expect(args.onYearChange).not.toHaveBeenCalled();
  },
};
