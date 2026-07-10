import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import SuggestPageView from "@/components/suggest/SuggestPageView";

const meta = {
  title: "Screens/Public/SuggestPageView",
  component: SuggestPageView,
} satisfies Meta<typeof SuggestPageView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
