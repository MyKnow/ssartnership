import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { ToastProvider } from "@/components/ui/Toast";
import PwaInstallButton from "./PwaInstallButton";

const meta = {
  title: "Domains/PwaInstallButton",
  component: PwaInstallButton,
  decorators: [
    (Story) => (
      <ToastProvider>
        <Story />
      </ToastProvider>
    ),
  ],
} satisfies Meta<typeof PwaInstallButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const DeferredPrompt: Story = {
  play: async ({ canvasElement }) => {
    window.fetch = async () => Response.json({ ok: true });
    const promptEvent = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: "accepted"; platform: string }>;
    };
    promptEvent.prompt = async () => {};
    promptEvent.userChoice = Promise.resolve({ outcome: "accepted", platform: "web" });
    window.dispatchEvent(promptEvent);

    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "앱 설치" }));
    await expect(await within(document.body).findByText("설치가 시작되었습니다.")).toBeInTheDocument();
  },
};
