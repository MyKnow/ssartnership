import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import PwaInstallButton from "./PwaInstallButton";

const meta = {
  title: "Domains/PwaInstallButton",
  component: PwaInstallButton,
} satisfies Meta<typeof PwaInstallButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PlatformGuideLink: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("link", { name: "앱 설치" })).toHaveAttribute(
      "href",
      "/install?platform=other",
    );
  },
};

export const DesktopNativePrompt: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const prompt = fn(async () => {});
    const promptEvent = new Event("beforeinstallprompt", {
      cancelable: true,
    }) as BeforeInstallPromptEvent;
    promptEvent.prompt = prompt;
    promptEvent.userChoice = Promise.resolve({
      outcome: "accepted",
      platform: "web",
    });
    window.dispatchEvent(promptEvent);

    await userEvent.click(await canvas.findByRole("button", { name: "앱 설치" }));
    await expect(prompt).toHaveBeenCalledOnce();
  },
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted"; platform: string }>;
};
