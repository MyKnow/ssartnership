"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import HomeView from "@/components/HomeView";
import { ToastProvider } from "@/components/ui/Toast";
import AppErrorScreen from "@/components/errors/AppErrorScreen";
import { HomePartnerExploreSkeleton } from "@/components/loading/SitePageSkeletons";
import type { Category, Partner } from "@/lib/types";

const categories: Category[] = [
  { key: "food", label: "식음료", description: "식사와 음료", color: "#2563eb" },
  { key: "health", label: "건강", description: "운동과 건강", color: "#0f766e" },
  { key: "education", label: "교육", description: "학습과 성장", color: "#7c3aed" },
];

function createPartner(index: number, overrides: Partial<Partner> = {}): Partner {
  return {
    id: `story-partner-${index}`,
    name: `역삼 제휴처 ${index}`,
    category: index % 2 === 0 ? "food" : "health",
    visibility: "public",
    createdAt: `2026-06-${String((index % 20) + 1).padStart(2, "0")}T00:00:00.000Z`,
    location: "서울 강남구 역삼동",
    period: { start: "2026-01-01", end: "2099-12-31" },
    thumbnail: null,
    images: [],
    conditions: ["내 인증 화면 제시"],
    benefits: ["전 메뉴 10% 할인", "평일 방문 시 음료 제공", "첫 방문 추가 혜택"],
    appliesTo: ["student", "staff"],
    tags: ["역삼", "당일이용"],
    ...overrides,
  };
}

const defaultPartners = [
  createPartner(1, { name: "바디라인 역삼점", category: "health" }),
  createPartner(2, { name: "오늘의 한 끼" }),
  createPartner(3, { name: "커리어 스튜디오", category: "education" }),
];

function HomeDirectoryStory({ partners }: { partners: Partner[] }) {
  return (
    <ToastProvider>
      <HomeView
        categories={categories}
        partners={partners}
        viewerAuthenticated
        currentUserId={null}
        loadedPartnerStateIds={partners.map((partner) => partner.id)}
      />
    </ToastProvider>
  );
}

const meta = {
  title: "Screens/Public/HomeDirectoryView",
  component: HomeDirectoryStory,
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
  args: { partners: defaultPartners },
} satisfies Meta<typeof HomeDirectoryStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: { partners: [] },
};

export const Many: Story = {
  args: { partners: Array.from({ length: 18 }, (_, index) => createPartner(index + 1)) },
};

export const LongKorean: Story = {
  args: {
    partners: [
      createPartner(21, {
        name: "서울 캠퍼스 구성원을 위한 아주 긴 이름의 역삼역 생활 편의 제휴처",
        benefits: [
          "평일 오후 다섯 시 이전 방문 시 모든 구성원에게 기본 할인과 추가 서비스를 함께 제공합니다",
          "내 인증 화면과 구성원 신분을 확인하면 예약 없이도 혜택을 적용할 수 있습니다",
          "일부 지점과 특정 행사 기간에는 제공 조건이 달라질 수 있습니다",
        ],
      }),
    ],
  },
};

export const Loading: Story = {
  render: () => <HomePartnerExploreSkeleton />,
};

export const Error: Story = {
  render: () => (
    <AppErrorScreen
      code="HOME_DIRECTORY_ERROR"
      title="혜택을 불러오지 못했습니다"
      description="잠시 후 다시 시도해 주세요. 문제가 계속되면 오류를 제보할 수 있습니다."
      onRetry={() => undefined}
    />
  ),
};
