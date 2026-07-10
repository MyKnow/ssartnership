"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import CampusLandingView from "@/components/campuses/CampusLandingView";
import { ToastProvider } from "@/components/ui/Toast";
import type { Category, Partner } from "@/lib/types";

const categories: Category[] = [
  { key: "food", label: "식음료", description: "식사와 음료", color: "#2563eb" },
  { key: "health", label: "건강", description: "운동과 건강", color: "#0f766e" },
];

const partners: Partner[] = [
  {
    id: "story-campus-cafe",
    name: "역삼 캠퍼스 카페",
    category: "food",
    visibility: "public",
    createdAt: "2026-07-01T00:00:00.000Z",
    location: "서울 강남구 역삼동",
    campusSlugs: ["seoul"],
    period: { start: "2026-01-01", end: "2099-12-31" },
    thumbnail: null,
    images: [],
    conditions: ["내 인증 화면 제시"],
    benefits: ["전 메뉴 10% 할인", "평일 음료 한 잔 추가 제공"],
    appliesTo: ["student", "staff"],
    tags: ["역삼", "당일 이용"],
  },
  {
    id: "story-campus-fitness",
    name: "서울 캠퍼스 피트니스",
    category: "health",
    visibility: "public",
    createdAt: "2026-07-02T00:00:00.000Z",
    location: "서울 강남구 테헤란로",
    campusSlugs: ["seoul"],
    period: { start: "2026-01-01", end: "2099-12-31" },
    thumbnail: null,
    images: [],
    conditions: ["내 인증 화면 제시"],
    benefits: ["1개월 이용권 15% 할인"],
    appliesTo: ["student"],
    tags: ["운동"],
  },
];

const meta = {
  title: "Screens/Public/CampusLandingView",
  component: CampusLandingView,
  decorators: [
    (Story) => (
      <ToastProvider>
        <Story />
      </ToastProvider>
    ),
  ],
  args: {
    campus: {
      label: "서울",
      fullLabel: "서울 캠퍼스",
      description: "역삼역과 강남권에서 이용할 수 있는 제휴 혜택을 모았습니다.",
    },
    publicPartnerCount: partners.length,
    categories,
    partners,
    viewerAuthenticated: true,
    currentUserId: "story-member-campus",
    partnerFavoriteStateById: { "story-campus-cafe": true },
    loadedPartnerStateIds: partners.map((partner) => partner.id),
  },
} satisfies Meta<typeof CampusLandingView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
