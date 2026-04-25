import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import Textarea from "./Textarea";

const meta = {
  title: "UI/Textarea",
  component: Textarea,
  args: {
    placeholder: "제휴 혜택 설명을 입력하세요",
  },
} satisfies Meta<typeof Textarea>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Filled: Story = {
  args: {
    defaultValue:
      "평일 14시 이후 학생증 제시 시 아메리카노 20% 할인, 동반 1인까지 동일 혜택 적용",
  },
};

export const Disabled: Story = {
  args: {
    defaultValue: "승인 완료된 혜택은 잠시 수정할 수 없습니다.",
    disabled: true,
  },
};
