import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import PageHeader from "@/components/ui/PageHeader";
import PartnerImageCarousel from "@/components/PartnerImageCarousel";
import AppErrorScreen from "@/components/errors/AppErrorScreen";
import { PublicPartnerDetailSkeleton } from "@/components/loading/RoutePageSkeletons";
import type { Partner } from "@/lib/types";
import PartnerDetailContactSection from "./PartnerDetailContactSection";
import PartnerDetailSummaryCard from "./PartnerDetailSummaryCard";

const partner: Partner = {
  id: "story-detail-partner",
  name: "바디라인 역삼점",
  category: "health",
  visibility: "public",
  createdAt: "2026-06-01T00:00:00.000Z",
  location: "서울 강남구 테헤란로 123",
  period: { start: "2026-01-01", end: "2099-12-31" },
  thumbnail: null,
  images: [],
  conditions: ["내 인증 화면 제시", "다른 프로모션과 중복 적용 불가"],
  benefits: ["월 이용권 20% 할인", "첫 방문 체형 상담 무료"],
  appliesTo: ["student", "staff"],
  detailDescription: "SSAFY 구성원이 캠퍼스 가까이에서 편하게 이용할 수 있는 제휴처입니다.",
  tags: ["운동", "역삼", "예약", "건강", "상담"],
};

function PartnerDetailScreenStory({ value }: { value: Partner }) {
  const action = {
    label: "인증하고 혜택 이용",
    href: "/certification",
    type: "certification" as const,
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        eyebrow="건강"
        title={value.name}
        description="핵심 혜택을 확인하고 바로 이용할 수 있습니다."
        backHref="/?category=health#benefits"
        backLabel="혜택 목록으로"
      />
      <PartnerDetailContactSection
        isActive
        contactCount={1}
        benefitUseAction={action}
        inquiryDisplay={null}
        normalizedLinks={{ benefitActionLink: "", reservationLink: "", inquiryLink: "" }}
        partnerId={value.id}
      />
      <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
        <PartnerDetailSummaryCard
          partner={value}
          categoryLabel="건강"
          mapLink={value.mapUrl}
          currentUserId={null}
          metrics={{
            favoriteCount: 32,
            reviewCount: 8,
            detailViews: 320,
            detailUv: 210,
            cardClicks: 120,
            mapClicks: 40,
            reservationClicks: 26,
            inquiryClicks: 12,
            totalClicks: 198,
          }}
        />
        <PartnerImageCarousel images={value.images ?? []} name={value.name} />
      </div>
    </div>
  );
}

const meta = {
  title: "Screens/Public/PartnerDetailView",
  component: PartnerDetailScreenStory,
  args: { value: partner },
  parameters: { viewport: { defaultViewport: "mobile1" } },
} satisfies Meta<typeof PartnerDetailScreenStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ManyAndLongKorean: Story = {
  args: {
    value: {
      ...partner,
      name: "서울 캠퍼스 구성원을 위한 긴 이름의 체형 교정과 건강 관리 전문 제휴처",
      benefits: Array.from(
        { length: 7 },
        (_, index) => `구성원 맞춤 혜택 ${index + 1}번과 이용 조건을 함께 확인해 주세요`,
      ),
      conditions: Array.from(
        { length: 6 },
        (_, index) => `상세 이용 조건 ${index + 1}번은 현장 상황에 따라 달라질 수 있습니다`,
      ),
    },
  },
};

export const Empty: Story = {
  args: {
    value: {
      ...partner,
      benefits: [],
      conditions: [],
      images: [],
      tags: [],
      detailDescription: null,
    },
  },
};

export const BrokenImage: Story = {
  args: {
    value: {
      ...partner,
      images: ["/storybook-missing-partner-image.webp"],
    },
  },
};

export const LongUrl: Story = {
  args: {
    value: {
      ...partner,
      mapUrl: `https://example.com/${"very-long-path-segment-".repeat(18)}`,
      detailDescription: `긴 링크와 식별자가 있어도 화면 폭을 밀어내지 않습니다. ${"가나다라마바사 ".repeat(12)}`,
    },
  },
};

export const Loading: Story = {
  render: () => <PublicPartnerDetailSkeleton />,
};

export const Error: Story = {
  render: () => (
    <AppErrorScreen
      code="PARTNER_DETAIL_ERROR"
      title="제휴처 정보를 불러오지 못했습니다"
      description="목록으로 돌아가거나 잠시 후 다시 시도해 주세요."
      onRetry={() => undefined}
    />
  ),
};
