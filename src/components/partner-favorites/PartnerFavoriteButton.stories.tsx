"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
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
  },
} satisfies Meta<typeof PartnerFavoriteButtonStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Active: Story = {
  args: {
    initialFavorited: true,
    favoriteCount: 129,
  },
};

export const Compact: Story = {
  args: {
    compact: true,
    favoriteCount: 8,
  },
};
