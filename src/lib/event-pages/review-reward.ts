import type { EventCampaign } from "@/lib/promotions/catalog";

export const REVIEW_REWARD_EVENT: EventCampaign = {
  slug: "review-reward",
  title: "브랜드 리뷰 추첨권 이벤트",
  shortTitle: "리뷰 이벤트",
  description:
    "이벤트 기간 내 브랜드 리뷰를 작성하면 추첨권을 받을 수 있습니다.",
  periodLabel: "이벤트 종료 시점 기준으로 조건이 유지되어야 인정됩니다.",
  startsAt: "2026-04-21T00:00:00+09:00",
  endsAt: "2026-06-30T23:59:59+09:00",
  heroImageSrc: "/ads/review-reward.svg",
  heroImageAlt: "브랜드 리뷰 작성으로 추첨권을 받는 이벤트",
  conditions: [
    {
      key: "review",
      title: "신규 리뷰 작성",
      description: "이벤트 기간 내 신규 리뷰 작성 시 리뷰 1개당 추첨권 1장을 지급합니다.",
      tickets: 1,
      ctaHref: "/#partner-explore",
      ctaLabel: "리뷰 작성",
      repeatable: true,
    },
  ],
  rules: [
    "모든 조건은 이벤트 종료 시점 기준으로 유지되어 있어야 인정됩니다.",
    "리뷰 삭제, 숨김, 운영 제외 처리 시 해당 추첨권은 회수됩니다.",
    "무성의한 리뷰, 동일 문구 반복, 광고성 리뷰는 운영진 판단에 따라 제외될 수 있습니다.",
    "당첨은 1인 1회로 제한됩니다.",
  ],
};
