import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import PageHeader from "@/components/ui/PageHeader";
import PartnerImageCarousel from "@/components/PartnerImageCarousel";
import AppErrorScreen from "@/components/errors/AppErrorScreen";
import { PublicPartnerDetailSkeleton } from "@/components/loading/RoutePageSkeletons";
import type { Partner } from "@/lib/types";
import PartnerDetailContactSection from "./PartnerDetailContactSection";
import PartnerDetailHeroMeta from "./PartnerDetailHeroMeta";
import PartnerDetailMobileActionBar from "./PartnerDetailMobileActionBar";
import PartnerDetailSummaryCard from "./PartnerDetailSummaryCard";

const demoImage = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 720">
    <rect width="960" height="720" fill="#dbeafe"/>
    <circle cx="480" cy="330" r="150" fill="#2563eb" opacity="0.18"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#1d4ed8" font-size="56" font-family="sans-serif">Partner</text>
  </svg>`,
)} `;

const partner: Partner = {
  id: "story-detail-partner",
  name: "바디라인 역삼점",
  category: "health",
  visibility: "public",
  createdAt: "2026-06-01T00:00:00.000Z",
  location: "서울 강남구 테헤란로 123",
  period: { start: "2026-01-01", end: "2099-12-31" },
  thumbnail: demoImage,
  images: [demoImage],
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
  const certificationBenefitAction = {
    partnerId: value.id,
    partnerName: value.name,
    benefitItems: value.benefits.map((title, index) => ({
      id: `story-benefit-${index + 1}`,
      title,
      maxApplyCount: null,
    })),
    returnTo: `/partners/${value.id}`,
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div
        data-partner-detail-hero
        className="grid min-w-0"
      >
        <div
          data-partner-detail-hero-info
          className="grid min-w-0 gap-4 rounded-card border border-border bg-surface p-6 shadow-flat md:gap-0 md:grid-cols-[140px_minmax(0,1fr)] md:items-stretch"
        >
          <PartnerImageCarousel
            className="mx-auto w-full max-w-none md:mx-0 md:max-w-[140px] md:self-center"
            images={value.thumbnail ? [value.thumbnail] : []}
            name={value.name}
            variant="hero"
            showThumbnails={false}
          />
          <div className="flex min-w-0 flex-col gap-4 md:ml-4">
            <PartnerDetailHeroMeta
              partnerId={value.id}
              categoryLabel="건강"
              currentUserId={null}
              favoriteCount={32}
            />
            <PageHeader
              className="h-full border-0 border-b-0 pb-0"
              title={value.name}
              description="핵심 혜택을 확인하고 바로 이용할 수 있습니다."
            />
          </div>
        </div>
      </div>

      {value.images?.length ? (
        <section
          aria-label={`${value.name} 추가 이미지`}
          data-partner-detail-gallery
          className="grid min-w-0 gap-3"
        >
          <PartnerImageCarousel
            images={value.images}
            name={`${value.name} 추가 이미지`}
            variant="main"
          />
        </section>
      ) : null}

      <PartnerDetailSummaryCard
        partner={value}
        mapLink={value.mapUrl}
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
            certificationBenefitAction={certificationBenefitAction}
          />
        }
      />
      <PartnerDetailMobileActionBar
        partnerId={value.id}
        benefitUseAction={action}
        certificationBenefitAction={certificationBenefitAction}
        inquiryAction={{
          label: "0507-1382-2343",
          href: "tel:050713822343",
        }}
      />
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
    await expect(summaryCard).not.toHaveClass("order-2");
    const imageCarouselButton = canvas.getByRole("button", {
      name: "바디라인 역삼점 이미지 크게 보기",
    });
    const hero = canvasElement.querySelector<HTMLElement>(
      "[data-partner-detail-hero]",
    );
    await expect(hero).not.toBeNull();
    await expect(hero).toHaveClass("grid", "min-w-0");
    const heroInfo = canvasElement.querySelector<HTMLElement>(
      "[data-partner-detail-hero-info]",
    );
    await expect(heroInfo).not.toBeNull();
    await expect(heroInfo).toHaveClass(
      "rounded-card",
      "border",
      "gap-4",
      "p-6",
      "md:gap-0",
      "md:grid-cols-[140px_minmax(0,1fr)]",
      "md:items-stretch",
    );
    const heroMeta = canvasElement.querySelector<HTMLElement>(
      "[data-partner-detail-hero-meta]",
    );
    await expect(heroMeta).not.toBeNull();
    await expect(within(heroMeta!).getByText("건강")).toBeVisible();
    await expect(
      within(heroMeta!).getByRole("button", { name: "공유 링크 복사" }),
    ).toBeVisible();
    await expect(
      within(heroMeta!).queryByLabelText("이용 기간 2026-01-01부터 2099-12-31까지"),
    ).toBeNull();
    const heroCarousel = canvasElement.querySelector<HTMLElement>(
      '[data-partner-image-carousel="hero"]',
    );
    await expect(heroCarousel).not.toBeNull();
    await expect(heroCarousel).toHaveClass(
      "max-w-none",
      "md:max-w-[140px]",
      "md:self-center",
    );
    await expect(
      canvasElement.querySelector<HTMLElement>("[data-partner-detail-hero-info] > div:nth-child(2)"),
    ).toHaveClass("md:ml-4");
    await expect(heroInfo).toContainElement(imageCarouselButton);
    await expect(imageCarouselButton).toHaveClass("aspect-square");
    const periodBadge = summaryCard.querySelector('[aria-label^="이용 기간"]');
    await expect(periodBadge).toBeInTheDocument();
    await expect(periodBadge).toHaveClass("h-8", "px-4", "py-1", "text-xs");
    await expect(
      canvas.queryByRole("link", { name: "혜택 목록으로" }),
    ).toBeNull();
    const gallery = canvasElement.querySelector<HTMLElement>(
      "[data-partner-detail-gallery]",
    );
    await expect(gallery).not.toBeNull();
    await expect(
      Boolean(
        hero &&
          gallery &&
          (hero.compareDocumentPosition(gallery) &
            Node.DOCUMENT_POSITION_FOLLOWING),
      ),
    ).toBe(true);
    await expect(
      Boolean(
        gallery &&
          summaryCard &&
          (gallery.compareDocumentPosition(summaryCard) &
            Node.DOCUMENT_POSITION_FOLLOWING),
      ),
    ).toBe(true);

    const primaryAction = summaryCard.querySelector<HTMLElement>(
      "[data-primary-benefit-action]",
    );
    await expect(primaryAction).toBeNull();
    const desktopActionFab = canvasElement.querySelector<HTMLElement>(
      "[data-partner-detail-desktop-action-fab]",
    );
    await expect(desktopActionFab).not.toBeNull();
    await expect(desktopActionFab).toHaveClass("hidden", "md:flex");
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

    const additionalInformation = summaryCard.querySelector<HTMLElement>(
      "[data-additional-information-section]",
    );
    await expect(additionalInformation).not.toBeNull();
    await expect(
      within(additionalInformation!).getByRole("heading", {
        level: 3,
        name: "이용조건 및 태그",
      }),
    ).toBeInTheDocument();
    await expect(additionalInformation).toHaveTextContent("이용 조건");
    await expect(additionalInformation).toHaveTextContent("#운동");
    await expect(additionalInformation).not.toHaveTextContent("제휴처 소개");
    await expect(additionalInformation?.querySelector("details")).toBeNull();

    const tagList = summaryCard.querySelector<HTMLElement>(
      "[data-partner-tag-list]",
    );
    await expect(tagList).not.toBeNull();
    await expect(tagList?.querySelectorAll("[data-partner-tag]")).toHaveLength(5);
    await expect(tagList).not.toHaveTextContent("+");

    const summaryContent = summaryCard.querySelector<HTMLElement>(
      "[data-partner-detail-summary-content]",
    );
    await expect(
      summaryContent?.querySelector("[data-primary-benefit-action-panel]"),
    ).toBeNull();
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
      thumbnail: null,
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
