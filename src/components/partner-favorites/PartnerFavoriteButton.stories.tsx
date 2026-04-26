"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { ToastProvider } from "@/components/ui/Toast";
import PartnerFavoriteButton from "./PartnerFavoriteButton";

function PartnerFavoriteButtonStory(props: React.ComponentProps<typeof PartnerFavoriteButton>) {
  return (
    <ToastProvider>
      <PartnerFavoriteButton {...props} />
    </ToastProvider>
  );
}

const meta = {
  title: "Domains/PartnerFavoriteButton",
  component: PartnerFavoriteButtonStory,
  args: {
    partnerId: "partner-1",
    initialFavorited: false,
    favoriteCount: 128,
    onToggle: fn(),
  },
} satisfies Meta<typeof PartnerFavoriteButtonStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ToggleOnSuccess: Story = {
  play: async ({ canvasElement, args }) => {
    window.fetch = async () =>
      Response.json({
        favorite: true,
        count: 129,
      });
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: "즐겨찾기" }));
    await expect(args.onToggle).toHaveBeenCalledWith(true);
    await expect(await canvas.findByRole("button", { name: "즐겨찾기 해제" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(canvas.getByText("129")).toBeInTheDocument();
    await expect(await within(document.body).findByText("즐겨찾기에 추가되었습니다.")).toBeInTheDocument();
  },
};

export const Active: Story = {
  args: {
    initialFavorited: true,
    favoriteCount: 129,
  },
};

export const ToggleOffFailureRollback: Story = {
  args: {
    initialFavorited: true,
    favoriteCount: 1,
  },
  play: async ({ canvasElement, args }) => {
    window.fetch = async () =>
      Response.json({ message: "로그인이 필요합니다." }, { status: 401 });
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: "즐겨찾기 해제" }));
    await expect(args.onToggle).toHaveBeenCalledWith(false);
    await expect(await canvas.findByRole("button", { name: "즐겨찾기 해제" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(canvas.getByText("1")).toBeInTheDocument();
    await expect(await within(document.body).findByText("로그인이 필요합니다.")).toBeInTheDocument();
  },
};

export const Compact: Story = {
  args: {
    compact: true,
    favoriteCount: 8,
  },
};
