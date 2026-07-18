import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { PromotionSlide } from "@/lib/promotions/catalog";
import PromotionCarousel from "./PromotionCarousel";

const storyImageSources = {
  blue:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 514'%3E%3Crect width='1200' height='514' fill='%231d4ed8'/%3E%3Ccircle cx='960' cy='80' r='260' fill='%2360a5fa' opacity='.55'/%3E%3Cpath d='M0 410c190-120 330-18 520-96 180-74 346-40 680 82v118H0z' fill='%231e3a8a'/%3E%3C/svg%3E",
  teal:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 514'%3E%3Crect width='1200' height='514' fill='%230f766e'/%3E%3Ccircle cx='190' cy='80' r='210' fill='%235eead4' opacity='.45'/%3E%3Cpath d='M0 360c240 70 350-80 580 10 180 70 340-4 620-80v224H0z' fill='%231342e8' opacity='.55'/%3E%3C/svg%3E",
  amber:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 514'%3E%3Crect width='1200' height='514' fill='%23b45309'/%3E%3Ccircle cx='930' cy='230' r='260' fill='%23fbbf24' opacity='.6'/%3E%3Cpath d='M0 440c220-80 390-10 570-92 230-104 380-22 630 28v138H0z' fill='%237c2d12' opacity='.75'/%3E%3C/svg%3E",
};

const slides: PromotionSlide[] = [
  {
    id: "story-partnership",
    title: "싸트너십 | SSAFY 제휴 혜택 플랫폼",
    description: "서울 캠퍼스 구성원을 위한 제휴 혜택을 한곳에서 확인합니다.",
    imageSrc: storyImageSources.blue,
    imageAlt: "SSAFY 제휴 혜택 플랫폼 광고",
    href: "/#partner-explore",
    sponsorLabel: "싸트너십",
  },
  {
    id: "story-reward",
    title: "SSAFY 구성원 추첨권 이벤트",
    description: "회원가입과 알림 설정으로 이벤트 추첨권을 받을 수 있습니다.",
    imageSrc: storyImageSources.teal,
    imageAlt: "추첨권 이벤트 광고",
    href: "/events/signup-reward",
  },
  {
    id: "story-campus",
    title: "캠퍼스별 제휴 혜택 탐색",
    description: "서울 캠퍼스 주변의 다양한 제휴처를 카테고리별로 찾아보세요.",
    imageSrc: storyImageSources.amber,
    imageAlt: "캠퍼스별 제휴 혜택 광고",
    href: "/campuses/seoul",
  },
];

const meta = {
  title: "Domains/Promotions/PromotionCarousel",
  component: PromotionCarousel,
  parameters: {
    viewport: { defaultViewport: "mobile1" },
    chromatic: { viewports: [360, 820, 1366] },
  },
  args: { slides },
} satisfies Meta<typeof PromotionCarousel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
