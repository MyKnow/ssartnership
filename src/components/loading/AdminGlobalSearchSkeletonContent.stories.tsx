import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AdminGlobalSearchSkeletonContent } from "./AdminGlobalSearchSkeletonContent";

const meta = {
  title: "Domains/Admin/AdminGlobalSearchSkeletonContent",
  component: AdminGlobalSearchSkeletonContent,
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof AdminGlobalSearchSkeletonContent>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
