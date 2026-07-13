import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import GraduateProfilePhotoForm from "./GraduateProfilePhotoForm";

const meta = {
  title: "Screens/Member/GraduateProfilePhotoForm",
  component: GraduateProfilePhotoForm,
  parameters: {
    nextjs: { appDirectory: true },
    chromatic: { viewports: [360, 430, 820, 1366] },
  },
} satisfies Meta<typeof GraduateProfilePhotoForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
