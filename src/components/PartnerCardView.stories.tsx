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

export const PublicCard: Story = {};

export const InteractivePublicCard: Story = {
  play: async ({ canvasElement, args }) => {
    window.fetch = async () => Response.json({ ok: true });
    const canvas = within(canvasElement);

    const detailLinks = canvas.getAllByRole("link", { name: "역삼 캠퍼스 샐러드 바 상세 보기" });
    await expect(detailLinks[detailLinks.length - 1]!).toHaveAttribute(
      "href",
      "/partners/partner-1",
    );
    await userEvent.click(canvas.getByRole("button", { name: "식음료 필터 적용" }));
    await expect(args.onCategoryClick).toHaveBeenCalledWith("food");

    await expect(canvas.getByRole("link", { name: "지도 보기" })).toHaveAttribute(
      "href",
      "https://maps.example.com/partner-1",
    );
    await expect(canvas.getByRole("link", { name: "혜택 이용" })).toHaveAttribute(
      "href",
      "https://booking.example.com/partner-1",
    );
    await expect(canvas.getByRole("link", { name: "문의하기" })).toHaveAttribute(
      "href",
      "https://pf.kakao.com/example",
    );
    const titleLink = detailLinks[detailLinks.length - 1]!;
    const mapLink = canvas.getByRole("link", { name: "지도 보기" });
    const reservationLink = canvas.getByRole("link", { name: "혜택 이용" });
    const inquiryLink = canvas.getByRole("link", { name: "문의하기" });
    [titleLink, mapLink, reservationLink, inquiryLink].forEach((link) => {
      link.addEventListener("click", (event) => event.preventDefault(), {
        once: true,
      });
    });
    await userEvent.click(titleLink);
    await userEvent.click(mapLink);
    await userEvent.click(reservationLink);
    await userEvent.click(inquiryLink);

    const card = canvas.getAllByRole("link", {
      name: "역삼 캠퍼스 샐러드 바 상세 보기",
    })[0]!;
    await userEvent.click(card);
    card.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
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
    await userEvent.click(canvas.getByRole("button", { name: "즐겨찾기 해제" }));
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
      canvas.getByText("현재 제휴기간이 아니므로, 혜택 이용/문의를 할 수 없습니다."),
    ).toBeInTheDocument();
    await expect(canvas.queryByRole("link", { name: "혜택 이용" })).not.toBeInTheDocument();
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
    card.focus();
    await userEvent.keyboard("{Enter}");
    await expect(card).not.toHaveAttribute("role", "link");
  },
};
