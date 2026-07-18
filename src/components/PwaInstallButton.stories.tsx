import { useEffect } from "react";
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

function DeferredPromptStory() {
  useEffect(() => {
    window.fetch = async () => Response.json({ ok: true });
    const promptEvent = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: "accepted"; platform: string }>;
    };
    promptEvent.prompt = async () => {};
    promptEvent.userChoice = Promise.resolve({ outcome: "accepted", platform: "web" });

    const timeoutId = window.setTimeout(() => {
      window.dispatchEvent(promptEvent);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  return <PwaInstallButton />;
}

export const DeferredPrompt: Story = {
  render: () => <DeferredPromptStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "앱 설치" }));
    await expect(await within(document.body).findByText("설치가 시작되었습니다.")).toBeInTheDocument();
  },
};

export const BrowserMenuFallback: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole("button", { name: "앱 설치" });
    await userEvent.click(button);
    await expect(
      await within(document.body).findByText(
        "브라우저 메뉴에서 '앱 설치' 또는 '홈 화면에 추가'를 선택해 주세요.",
      ),
    ).toBeInTheDocument();
  },
};
