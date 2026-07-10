import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import AdminMemberCommunicationPanel from "./AdminMemberCommunicationPanel";

const meta = {
  title: "Domains/Admin/AdminMemberCommunicationPanel",
  component: AdminMemberCommunicationPanel,
  args: {
    preferences: {
      enabled: true,
      announcementEnabled: true,
      newPartnerEnabled: true,
      expiringPartnerEnabled: false,
      reviewEnabled: true,
      mmEnabled: false,
      marketingEnabled: true,
      activeDeviceCount: 3,
    },
    policyStates: [
      {
        kind: "service",
        label: "서비스 이용약관",
        status: "current",
        statusLabel: "현재 동의",
        version: 3,
        eventAt: "2026-07-01T09:00:00+09:00",
        eventLabel: "동의 시각",
        title: "싸트너십 서비스 이용약관",
        effectiveAt: "2026-07-01T00:00:00+09:00",
      },
      {
        kind: "privacy",
        label: "개인정보 처리방침",
        status: "outdated",
        statusLabel: "이전 버전 동의",
        version: 2,
        eventAt: "2026-06-01T09:00:00+09:00",
        eventLabel: "동의 시각",
        title: "개인정보 수집·이용 및 처리에 관한 상세 방침",
        effectiveAt: "2026-06-01T00:00:00+09:00",
      },
      {
        kind: "marketing",
        label: "마케팅 정보 수신",
        status: "revoked",
        statusLabel: "철회됨",
        version: 1,
        eventAt: "2026-07-03T18:30:00+09:00",
        eventLabel: "철회 시각",
        title: "마케팅 및 이벤트 정보 수신 동의",
        effectiveAt: "2026-04-01T00:00:00+09:00",
      },
    ],
    consentTimeline: [
      {
        kind: "marketing",
        agreed: false,
        at: "2026-07-03T18:30:00+09:00",
        version: 1,
        title: "마케팅 및 이벤트 정보 수신 동의",
        effectiveAt: "2026-04-01T00:00:00+09:00",
      },
      {
        kind: "service",
        agreed: true,
        at: "2026-07-01T09:00:00+09:00",
        version: 3,
        title: "싸트너십 서비스 이용약관",
        effectiveAt: "2026-07-01T00:00:00+09:00",
      },
      {
        kind: "privacy",
        agreed: true,
        at: "2026-06-01T09:00:00+09:00",
        version: 2,
        title: "개인정보 수집·이용 및 처리에 관한 상세 방침",
        effectiveAt: "2026-06-01T00:00:00+09:00",
      },
    ],
  },
  parameters: {
    chromatic: { viewports: [360, 820, 1366] },
  },
} satisfies Meta<typeof AdminMemberCommunicationPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const EmptyHistory: Story = {
  args: {
    preferences: {
      enabled: false,
      announcementEnabled: true,
      newPartnerEnabled: true,
      expiringPartnerEnabled: true,
      reviewEnabled: true,
      mmEnabled: true,
      marketingEnabled: false,
      activeDeviceCount: 0,
    },
    consentTimeline: [],
  },
};
