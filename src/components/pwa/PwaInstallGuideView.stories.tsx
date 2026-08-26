import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import PwaInstallGuideView from "@/components/pwa/PwaInstallGuideView";

const meta = {
  title: "Screens/Public/PwaInstallGuideView",
  component: PwaInstallGuideView,
  parameters: {
    viewport: { defaultViewport: "mobile1" },
    chromatic: { viewports: [360, 820, 1366] },
  },
  args: {
    platform: "android",
  },
} satisfies Meta<typeof PwaInstallGuideView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Android: Story = {};

export const IosAndIpadOs: Story = {
  args: { platform: "ios" },
};

export const OtherBrowser: Story = {
  args: { platform: "other" },
};
