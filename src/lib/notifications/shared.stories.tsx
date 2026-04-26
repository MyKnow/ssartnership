import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import {
  getNotificationChannelLabel,
  getNotificationTypeLabel,
  normalizeNotificationTargetUrl,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_DELIVERY_STATUSES,
} from "./shared";

function NotificationsSharedPreview() {
  return (
    <div className="space-y-2 text-sm text-foreground">
      <div>channels:{NOTIFICATION_CHANNELS.join(",")}</div>
      <div>statuses:{NOTIFICATION_DELIVERY_STATUSES.join(",")}</div>
      <div>target-empty:{String(normalizeNotificationTargetUrl(""))}</div>
      <div>target-local:{normalizeNotificationTargetUrl("/partners/partner-1")}</div>
      <div>target-slashes:{String(normalizeNotificationTargetUrl("//evil.com"))}</div>
      <div>target-absolute:{String(normalizeNotificationTargetUrl("https://example.com"))}</div>
      <div>type-announcement:{getNotificationTypeLabel("announcement")}</div>
      <div>type-new:{getNotificationTypeLabel("new_partner")}</div>
      <div>type-expiring:{getNotificationTypeLabel("expiring_partner")}</div>
      <div>type-marketing:{getNotificationTypeLabel("marketing")}</div>
      <div>type-system:{getNotificationTypeLabel("system")}</div>
      <div>type-default:{getNotificationTypeLabel("other")}</div>
      <div>channel-inapp:{getNotificationChannelLabel("in_app")}</div>
      <div>channel-push:{getNotificationChannelLabel("push")}</div>
      <div>channel-mm:{getNotificationChannelLabel("mm")}</div>
    </div>
  );
}

const meta = {
  title: "Domains/Lib/NotificationsShared",
  component: NotificationsSharedPreview,
} satisfies Meta<typeof NotificationsSharedPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Summary: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("channels:in_app,push,mm")).toBeInTheDocument();
    await expect(canvas.getByText("statuses:pending,sent,failed,skipped")).toBeInTheDocument();
    await expect(canvas.getByText("target-empty:null")).toBeInTheDocument();
    await expect(canvas.getByText("target-local:/partners/partner-1")).toBeInTheDocument();
    await expect(canvas.getByText("target-slashes:null")).toBeInTheDocument();
    await expect(canvas.getByText("target-absolute:null")).toBeInTheDocument();
    await expect(canvas.getByText("type-announcement:운영 공지")).toBeInTheDocument();
    await expect(canvas.getByText("type-new:신규 제휴")).toBeInTheDocument();
    await expect(canvas.getByText("type-expiring:종료 임박")).toBeInTheDocument();
    await expect(canvas.getByText("type-marketing:마케팅")).toBeInTheDocument();
    await expect(canvas.getByText("type-system:시스템")).toBeInTheDocument();
    await expect(canvas.getByText("type-default:알림")).toBeInTheDocument();
    await expect(canvas.getByText("channel-inapp:앱")).toBeInTheDocument();
    await expect(canvas.getByText("channel-push:푸시")).toBeInTheDocument();
    await expect(canvas.getByText("channel-mm:MM")).toBeInTheDocument();
  },
};
