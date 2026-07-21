"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
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
    onCategoryClick: fn(),
  },
} satisfies Meta<typeof PartnerCardViewStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PublicCard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("식음료")).toHaveClass("h-9", "py-0.5");
    await expect(canvas.getByLabelText("즐겨찾기 128개")).toHaveClass(
      "h-9",
      "py-1",
    );
  },
};

export const InteractivePublicCard: Story = {
  play: async ({ canvasElement, args }) => {
    window.fetch = async () => Response.json({ ok: true });
    const canvas = within(canvasElement);

    const titleLink = canvas.getByRole("link", {
      name: "역삼 캠퍼스 샐러드 바 상세 보기",
    });
    const detailLink = canvas.getByRole("link", { name: "제휴 상세 보기" });
    await expect(titleLink).toHaveAttribute(
      "href",
      "/partners/partner-1",
    );
    await expect(detailLink).toHaveAttribute("href", "/partners/partner-1");
    await userEvent.click(canvas.getByRole("button", { name: "식음료 필터 적용" }));
    await expect(args.onCategoryClick).toHaveBeenCalledWith("food");

    await expect(canvas.queryByRole("link", { name: "지도 보기" })).not.toBeInTheDocument();
    await expect(canvas.queryByRole("link", { name: "혜택 이용" })).not.toBeInTheDocument();
    await expect(canvas.queryByRole("link", { name: "문의하기" })).not.toBeInTheDocument();
    [titleLink, detailLink].forEach((link) => {
      link.addEventListener("click", (event) => event.preventDefault(), {
        once: true,
      });
    });
    await userEvent.click(titleLink);
    await userEvent.click(detailLink);
  },
};

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
  play: async ({ canvasElement }) => {
    window.fetch = async () =>
      Response.json({
        favorite: false,
        count: 127,
      });
    const canvas = within(canvasElement);
    const favoriteButton = canvas.getByRole("button", { name: "즐겨찾기 해제" });
    const favoriteChip = favoriteButton.querySelector("span.h-9");
    await expect(favoriteChip).not.toBeNull();
    await expect(favoriteChip).toHaveClass("py-1");
    await userEvent.click(favoriteButton);
    await expect(await canvas.findByRole("button", { name: "즐겨찾기" })).toBeInTheDocument();
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

export const CompactListCard: Story = {
  args: {
    variant: "list",
    partner: {
      ...basePartner,
      thumbnail: demoImage,
      images: [demoImage],
    },
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile2",
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const detailAction = canvas.getByRole("link", {
      name: "제휴 상세 보기",
      hidden: true,
    });
    const actionContainer = canvasElement.querySelector<HTMLElement>(
      "[data-partner-card-actions]",
    );
    const card = canvas.getByTestId("partner-card");

    await expect(detailAction).not.toBeVisible();
    await expect(actionContainer).toHaveClass("hidden", "min-[480px]:flex");
    await expect(card).toHaveClass(
      "grid-cols-1",
      "min-[480px]:grid-cols-[minmax(0,1fr)_2.75rem]",
    );
    await expect(
      canvas.getByRole("link", {
        name: "역삼 캠퍼스 샐러드 바 상세 보기",
      }),
    ).toBeVisible();
  },
};

export const CompactListFavoritable: Story = {
  args: {
    variant: "list",
    currentUserId: "member-1",
    isFavorited: true,
    partner: {
      ...basePartner,
      thumbnail: demoImage,
      images: [demoImage],
    },
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile2",
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const favoriteButton = canvas.getByRole("button", {
      name: "즐겨찾기 해제",
    });

    await expect(favoriteButton).toHaveClass("!h-11", "!px-3", "min-h-11");
    await expect(favoriteButton.querySelector("span.h-9")).not.toBeNull();
    await expect(favoriteButton.getBoundingClientRect().width).toBeGreaterThan(
      favoriteButton.getBoundingClientRect().height,
    );
    const media = canvasElement.querySelector<HTMLElement>(
      "[data-partner-card-media]",
    );
    const primaryContent = canvasElement.querySelector<HTMLElement>(
      "[data-partner-card-primary-content]",
    );
    await expect(media).not.toBeNull();
    await expect(primaryContent).not.toBeNull();
    await expect(media).toHaveClass("size-20", "min-[390px]:size-24");
    await expect(media?.getBoundingClientRect().width).toBe(
      media?.getBoundingClientRect().height,
    );
    await expect(
      (media?.getBoundingClientRect().right ?? 0) + 8,
    ).toBeLessThanOrEqual(primaryContent?.getBoundingClientRect().left ?? 0);
  },
};

export const CompactListWithoutAddress: Story = {
  args: {
    variant: "list",
    partner: {
      ...basePartner,
      location: "온라인",
      thumbnail: demoImage,
      images: [demoImage],
    },
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile2",
    },
  },
  play: async ({ canvasElement }) => {
    const locationSlot = canvasElement.querySelector<HTMLElement>(
      "[data-partner-card-location]",
    );
    const media = canvasElement.querySelector<HTMLElement>(
      "[data-partner-card-media]",
    );
    const primaryContent = canvasElement.querySelector<HTMLElement>(
      "[data-partner-card-primary-content]",
    );

    await expect(locationSlot).not.toBeNull();
    await expect(locationSlot).toHaveClass("min-h-4", "sm:min-h-5");
    await expect(locationSlot).toHaveAttribute("aria-hidden", "true");
    await expect(media).toHaveClass("size-20", "min-[390px]:size-24");
    await expect(
      (media?.getBoundingClientRect().right ?? 0) + 8,
    ).toBeLessThanOrEqual(primaryContent?.getBoundingClientRect().left ?? 0);
  },
};

export const LongKoreanContentOnMobile: Story = {
  args: {
    partner: {
      ...basePartner,
      name: "피치플레이헬스&필라테스 역삼점 서울 강남 캠퍼스 제휴처",
      location: "서울 강남구 논현로86길 20 지하1층 역삼역 3번 출구 인근",
      benefits: [
        "헬스 1개월 33,000원 및 필라테스 10회 199,000원",
        "신규 회원 등록 시 운동복 무료 대여",
        "개인별 체험 상담 제공",
      ],
      thumbnail: demoImage,
      images: [demoImage],
    },
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const card = canvas.getByTestId("partner-card");
    const title = canvas.getByRole("link", {
      name: "피치플레이헬스&필라테스 역삼점 서울 강남 캠퍼스 제휴처 상세 보기",
    });
    const location = canvasElement.querySelector<HTMLElement>(
      "[data-partner-card-location]",
    );

    await expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth);
    await expect(title).toHaveClass("truncate");
    await expect(location).not.toBeNull();
    await expect(location).toHaveClass("line-clamp-2");
  },
};

export const InactivePeriod: Story = {
  args: {
    partner: {
      ...basePartner,
      period: {
        start: "2025-01-01",
        end: "2025-12-31",
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("현재 이용할 수 없는 제휴입니다."),
    ).toBeInTheDocument();
    await expect(canvas.queryByRole("link", { name: "혜택 이용" })).not.toBeInTheDocument();
  },
};

export const CompactInactivePeriod: Story = {
  args: {
    variant: "list",
    partner: {
      ...basePartner,
      period: {
        start: "2025-01-01",
        end: "2025-12-31",
      },
    },
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile2",
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("link", {
        name: "역삼 캠퍼스 샐러드 바 상세 보기 · 현재 이용할 수 없는 제휴",
      }),
    ).toHaveAttribute("href", "/partners/partner-1");
    await expect(
      canvas.queryByText("현재 이용할 수 없는 제휴입니다."),
    ).not.toBeInTheDocument();
  },
};

export const ConfidentialGuestCard: Story = {
  args: {
    partner: {
      ...basePartner,
      visibility: "confidential",
    },
    viewerAuthenticated: false,
  },
};

export const WithoutDetailHref: Story = {
  args: {
    partner: {
      ...basePartner,
      id: "",
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const card = canvas.getByTestId("partner-card");
    await userEvent.click(card);
    await expect(card).not.toHaveAttribute("role", "link");
    await expect(
      canvas.getByRole("button", { name: "제휴 상세 보기" }),
    ).toBeDisabled();
  },
};
