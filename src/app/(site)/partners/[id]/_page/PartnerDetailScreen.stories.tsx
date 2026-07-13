import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
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
          detailPanel={
            <PartnerDetailContactSection
              isActive
              contactCount={2}
              benefitUseAction={action}
              inquiryDisplay={{
                label: "0507-1382-2343",
                href: "tel:050713822343",
                type: "phone",
              }}
              normalizedLinks={{
                benefitActionLink: "",
                reservationLink: "",
                inquiryLink: "0507-1382-2343",
              }}
              partnerId={value.id}
            />
          }
          primaryActionPanel={
            <PartnerDetailContactSection
              isActive
              contactCount={2}
              benefitUseAction={action}
              inquiryDisplay={{
                label: "0507-1382-2343",
                href: "tel:050713822343",
                type: "phone",
              }}
              normalizedLinks={{
                benefitActionLink: "",
                reservationLink: "",
                inquiryLink: "0507-1382-2343",
              }}
              partnerId={value.id}
              mode="primary"
              className="hidden md:block"
            />
          }
        />
        <PartnerImageCarousel
          images={value.images ?? []}
          name={value.name}
          className="order-1 xl:order-2"
        />
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

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const benefitList = canvas.getByRole("list", { name: "제휴 혜택" });
    await expect(within(benefitList).getAllByRole("listitem")).toHaveLength(2);
    await expect(canvas.queryByText("SSAFY 구성원 혜택")).not.toBeInTheDocument();
    await expect(
      canvas.queryByText("방문하거나 이용하기 전에 적용 대상과 기간을 확인하세요."),
    ).not.toBeInTheDocument();
    await expect(canvas.queryByText("바로 이용")).not.toBeInTheDocument();

    const usageInformation = canvas.getByRole("group", { name: "이용 정보" });
    await expect(usageInformation).toHaveTextContent("이용 위치");
    await expect(usageInformation).toHaveTextContent("적용 대상");

    const audienceList = within(usageInformation).getByRole("list", {
      name: "적용 대상 목록",
    });
    await expect(audienceList).toHaveClass("grid-cols-2");
    await expect(audienceList).toHaveClass("min-[480px]:grid-cols-3");
    const staffAudience = within(audienceList).getByRole("listitem", {
      name: "운영진: 적용 대상",
    });
    await expect(staffAudience).toBeVisible();
    await expect(staffAudience.firstElementChild).toHaveClass("!bg-primary");
    await expect(staffAudience.firstElementChild).toHaveClass(
      "!text-primary-foreground",
    );
    await expect(
      within(audienceList).getByRole("listitem", {
        name: "교육생: 적용 대상",
      }),
    ).toBeVisible();
    const graduateAudience = within(audienceList).getByRole("listitem", {
      name: "수료생: 적용 대상 아님",
    });
    await expect(graduateAudience).toBeVisible();
    await expect(graduateAudience.firstElementChild).toHaveClass(
      "border-dashed",
    );
    await expect(
      graduateAudience.querySelector("[data-audience-status-dot]"),
    ).toHaveClass("bg-muted-foreground");

    const summaryCard = canvasElement.querySelector<HTMLElement>(
      "[data-partner-detail-summary]",
    );
    await expect(summaryCard).not.toBeNull();
    if (!summaryCard) {
      return;
    }
    await expect(summaryCard).toHaveClass("order-2", "xl:order-1");
    const imageCarouselButton = canvas.getByRole("button", {
      name: "바디라인 역삼점 이미지 크게 보기",
    });
    await expect(imageCarouselButton.parentElement).toHaveClass(
      "order-1",
      "xl:order-2",
    );

    const primaryAction = summaryCard.querySelector<HTMLElement>(
      "[data-primary-benefit-action]",
    );
    await expect(primaryAction).not.toBeNull();
    await expect(primaryAction).toHaveClass("w-full");
    const inquirySection = summaryCard.querySelector<HTMLElement>(
      "[data-inquiry-section]",
    );
    await expect(inquirySection).not.toBeNull();
    await expect(inquirySection).toBeVisible();
    await expect(
      within(inquirySection!).getByText("연락처"),
    ).toBeInTheDocument();
    await expect(
      within(inquirySection!).queryByText("문의"),
    ).not.toBeInTheDocument();
    await expect(
      within(inquirySection!).getByText("0507-1382-2343"),
    ).toBeInTheDocument();
    const inquiryLink = within(inquirySection!).getByRole("link", {
      name: "0507-1382-2343",
    });
    await expect(inquiryLink.scrollWidth).toBeLessThanOrEqual(
      inquiryLink.clientWidth,
    );
    await expect(inquirySection).toHaveAttribute("data-detail-info-row");
    await expect(
      within(summaryCard).getByRole("heading", {
        level: 2,
        name: "세부 정보",
      }),
    ).toBeInTheDocument();

    const usageInformationLayout = summaryCard.querySelector<HTMLElement>(
      "[data-usage-information-layout]",
    );
    await expect(usageInformationLayout).toHaveClass("grid-cols-1");
    await expect(usageInformationLayout).toHaveClass("gap-3");
    await expect(usageInformationLayout).not.toHaveClass("md:grid-cols-2");
    const usageSections = usageInformationLayout?.querySelectorAll(
      "[data-usage-information-section]",
    );
    await expect(usageSections).toHaveLength(2);
    usageSections?.forEach((section) => {
      expect(section).toHaveClass("rounded-[1.25rem]");
      expect(section).toHaveClass("border");
    });

    const detailInformationRows = summaryCard.querySelectorAll(
      "[data-detail-info-row]",
    );
    await expect(detailInformationRows).toHaveLength(3);
    await expect(detailInformationRows[0]?.parentElement).toBe(
      detailInformationRows[1]?.parentElement,
    );
    await expect(detailInformationRows[1]?.parentElement).toBe(
      detailInformationRows[2]?.parentElement,
    );
    detailInformationRows.forEach((row) => {
      expect(row.querySelector("[data-detail-info-divider]")).not.toBeNull();
      expect(row).toHaveClass("flex");
      expect(row).toHaveClass("items-center");
      expect(
        row.querySelector("[data-detail-info-row-layout]"),
      ).toHaveClass("grid-cols-1", "gap-y-3");
      expect(
        row.querySelector("[data-detail-info-row-layout]"),
      ).toHaveClass("min-[480px]:grid-cols-[6rem_1px_minmax(0,1fr)]");
      expect(
        row.querySelector("[data-detail-info-row-layout]"),
      ).toHaveClass("w-full");
      expect(
        row.querySelector("[data-detail-info-label]"),
      ).toHaveClass("justify-start", "min-[480px]:justify-center");
      expect(
        row.querySelector("[data-detail-info-divider]"),
      ).toHaveClass("h-px", "w-full", "min-[480px]:h-8", "min-[480px]:w-px");
    });

    const additionalInformationSummary = summaryCard.querySelector<HTMLElement>(
      "[data-additional-information-summary]",
    );
    await expect(additionalInformationSummary).toHaveClass("truncate");
    await expect(additionalInformationSummary).toHaveTextContent(
      "이용 조건과 제휴처 정보 · 조건 2 · 태그 5 · 제휴처 소개",
    );
    const additionalInformation = additionalInformationSummary?.closest("details");
    await expect(additionalInformation).not.toHaveAttribute("open");

    const tagList = summaryCard.querySelector<HTMLElement>(
      "[data-partner-tag-list]",
    );
    await expect(tagList).not.toBeNull();
    await expect(tagList?.querySelectorAll("[data-partner-tag]")).toHaveLength(5);
    await expect(tagList).not.toHaveTextContent("+");

    const summaryContent = summaryCard.querySelector<HTMLElement>(
      "[data-partner-detail-summary-content]",
    );
    await expect(summaryContent?.lastElementChild).toHaveAttribute(
      "data-primary-benefit-action-panel",
    );
  },
};

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
