"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import PartnerCardView from "./PartnerCardView";
import { ToastProvider } from "@/components/ui/Toast";
import type { Partner } from "@/lib/types";

const demoImage = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640">
    <defs>
      <linearGradient id="card" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stop-color="#dbeafe"/>
        <stop offset="100%" stop-color="#bfdbfe"/>
      </linearGradient>
    </defs>
    <rect width="640" height="640" rx="36" fill="url(#card)"/>
    <text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle" fill="#1e3a8a" font-size="40" font-family="sans-serif">Partner</text>
  </svg>`,
)}`;

const basePartner: Partner = {
  id: "partner-1",
  name: "역삼 캠퍼스 샐러드 바",
  category: "food",
  visibility: "public",
  createdAt: "2026-04-25T10:00:00.000Z",
  location: "서울 강남구 테헤란로 212",
  mapUrl: "https://maps.example.com/partner-1",
  reservationLink: "https://booking.example.com/partner-1",
  inquiryLink: "https://pf.kakao.com/example",
  period: {
    start: "2026-04-01",
    end: "2026-12-31",
  },
  conditions: ["학생증 또는 SSAFY 인증 화면 제시"],
  benefits: ["샐러드 전 메뉴 10% 할인", "점심 세트 음료 무료 업그레이드"],
  appliesTo: ["student"],
  thumbnail: null,
  images: [],
  tags: ["점심", "건강식"],
};

function PartnerCardViewStory(props: React.ComponentProps<typeof PartnerCardView>) {
  return (
    <ToastProvider>
      <div className="max-w-md">
        <PartnerCardView {...props} />
      </div>
    </ToastProvider>
  );
}

const meta = {
  title: "Domains/PartnerCardView",
  component: PartnerCardViewStory,
  args: {
    partner: basePartner,
    categoryLabel: "식음료",
    categoryColor: "#2563eb",
    viewerAuthenticated: true,
    isFavorited: false,
    metrics: {
      favoriteCount: 128,
      reviewCount: 18,
      detailViews: 420,
    },
    onCategoryClick: () => {},
  },
} satisfies Meta<typeof PartnerCardViewStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PublicCard: Story = {};

export const LockedCard: Story = {
  args: {
    partner: {
      ...basePartner,
      visibility: "private",
    },
    viewerAuthenticated: false,
  },
};

export const Favoritable: Story = {
  args: {
    currentUserId: "member-1",
    isFavorited: true,
  },
};

export const WithThumbnail: Story = {
  args: {
    partner: {
      ...basePartner,
      thumbnail: demoImage,
      images: [demoImage],
    },
  },
};
