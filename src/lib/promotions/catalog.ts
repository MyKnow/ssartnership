import { listEventPageDefinitions } from "@/lib/event-pages";

export type PromotionAudience = "guest" | "student" | "graduate" | "staff";

export const PROMOTION_AUDIENCE_OPTIONS: Array<{
  key: PromotionAudience;
  label: string;
  description: string;
}> = [
  {
    key: "guest",
    label: "게스트",
    description: "로그인하지 않은 방문자",
  },
  {
    key: "student",
    label: "교육생",
    description: "현재 기수 및 직전 기수 교육생",
  },
  {
    key: "graduate",
    label: "수료생",
    description: "이전 기수 수료생",
  },
  {
    key: "staff",
    label: "운영진",
    description: "운영진 계정",
  },
];

export const DEFAULT_PROMOTION_AUDIENCES: PromotionAudience[] = [
  "guest",
  "student",
  "graduate",
  "staff",
];

export type PromotionSlide = {
  id: string;
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  href: string;
  audiences?: PromotionAudience[];
  allowedCampuses?: string[];
};

export type EventConditionKey = "signup" | "mm" | "push" | "marketing" | "review";

export type EventCondition = {
  key: EventConditionKey;
  title: string;
  description: string;
  tickets: number;
  ctaHref: string;
  ctaLabel: string;
  repeatable?: boolean;
};

export type EventCampaign = {
  slug: string;
  title: string;
  shortTitle: string;
  description: string;
  periodLabel: string;
  startsAt: string;
  endsAt: string;
  heroImageSrc: string;
  heroImageAlt: string;
  conditions: EventCondition[];
  rules: string[];
};

export const EVENT_CAMPAIGNS: EventCampaign[] = listEventPageDefinitions();

export function getEventCampaign(slug: string) {
  return EVENT_CAMPAIGNS.find((campaign) => campaign.slug === slug) ?? null;
}

export const HOME_PROMOTIONS: PromotionSlide[] = [
  {
    id: "partnership-overview",
    title: "싸트너십 | SSAFY 제휴 혜택 플랫폼",
    description:
      "SSAFY 구성원을 위한 캠퍼스 주변 제휴 혜택을 카테고리별로 빠르게 찾습니다.",
    imageSrc: "/ads/home-partnership-overview.svg",
    imageAlt: "SSAFY 제휴 혜택을 한곳에서 확인하는 광고",
    href: "/#partner-explore",
    audiences: [...DEFAULT_PROMOTION_AUDIENCES],
    allowedCampuses: [],
  },
  {
    id: "signup-reward",
    title: "싸트너십 추첨권 이벤트",
    description: "회원가입, 알림 설정, 리뷰 작성으로 추첨권을 받을 수 있습니다.",
    imageSrc: "/ads/reward-event.svg",
    imageAlt: "회원가입, 알림, 마케팅 동의, 리뷰 작성 추첨권 이벤트 광고",
    href: "/events/signup-reward",
    audiences: [...DEFAULT_PROMOTION_AUDIENCES],
    allowedCampuses: [],
  },
  {
    id: "campus-partners",
    title: "캠퍼스별 제휴 탐색",
    description: "서울 캠퍼스부터 캠퍼스별 제휴 혜택을 따로 확인합니다.",
    imageSrc: "/ads/campus-partners.svg",
    imageAlt: "캠퍼스별 제휴 혜택 탐색 광고",
    href: "/campuses/seoul",
    audiences: [...DEFAULT_PROMOTION_AUDIENCES],
    allowedCampuses: [],
  },
];
