import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { SITE_URL } from "./site";
import { sanitizeReturnTo } from "./return-to";

function ReturnToPreview() {
  return (
    <div className="space-y-2 text-sm text-foreground">
      <div>empty:{sanitizeReturnTo("", "/home")}</div>
      <div>slashes:{sanitizeReturnTo("//evil.com", "/home")}</div>
      <div>relative:{sanitizeReturnTo("partners", "/home")}</div>
      <div>local-path:{sanitizeReturnTo("/partners?tab=all#top", "/home")}</div>
      <div>same-origin:{sanitizeReturnTo(`${SITE_URL}/admin?tab=logs#recent`, "/home")}</div>
      <div>other-origin:{sanitizeReturnTo("https://evil.com/phish", "/home")}</div>
      <div>invalid-url:{sanitizeReturnTo("http://[invalid", "/home")}</div>
    </div>
  );
}

const meta = {
  title: "Domains/Lib/ReturnTo",
  component: ReturnToPreview,
} satisfies Meta<typeof ReturnToPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Summary: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("empty:/home")).toBeInTheDocument();
    await expect(canvas.getByText("slashes:/home")).toBeInTheDocument();
    await expect(canvas.getByText("relative:/home")).toBeInTheDocument();
    await expect(canvas.getByText("local-path:/partners?tab=all#top")).toBeInTheDocument();
    await expect(canvas.getByText("same-origin:/admin?tab=logs#recent")).toBeInTheDocument();
    await expect(canvas.getByText("other-origin:/home")).toBeInTheDocument();
    await expect(canvas.getByText("invalid-url:/home")).toBeInTheDocument();
  },
};
