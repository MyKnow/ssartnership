import type { EventCampaign } from "@/lib/promotions/catalog";

export const SIGNUP_REWARD_EVENT: EventCampaign = {
  slug: "signup-reward",
  title: "싸트너십 추첨권 이벤트",
  shortTitle: "추첨권 이벤트",
  description:
    "회원가입, 알림 채널 활성화, 마케팅/이벤트 수신 동의, 신규 리뷰 작성으로 추첨권을 받을 수 있습니다.",
  periodLabel: "이벤트 종료 시점 기준으로 조건이 유지되어야 인정됩니다.",
  startsAt: "2026-04-20T00:00:00+09:00",
  endsAt: "2026-05-12T23:59:59+09:00",
  heroImageSrc: "/ads/reward-event.svg",
  heroImageAlt: "싸트너십 회원 참여 추첨권 이벤트",
  conditions: [
    {
      key: "signup",
      title: "싸트너십 회원가입",
      description: "이벤트 기간 내 신규 가입 시 추첨권 1장을 지급합니다.",
      tickets: 1,
      ctaHref: "/auth/signup",
      ctaLabel: "회원가입",
    },
    {
      key: "mm",
      title: "Mattermost 알림 채널",
      description: "Mattermost 알림 채널 활성화 시 추첨권 1장을 지급합니다.",
      tickets: 1,
      ctaHref: "/notifications",
      ctaLabel: "알림 설정",
    },
    {
      key: "push",
      title: "푸시 알림",
      description: "브라우저 푸시 알림 활성화 시 추첨권 1장을 지급합니다.",
      tickets: 1,
      ctaHref: "/notifications",
      ctaLabel: "푸시 켜기",
    },
    {
      key: "marketing",
      title: "마케팅/이벤트 수신 동의",
      description: "마케팅/이벤트 수신 동의 유지 시 추첨권 2장을 지급합니다.",
      tickets: 2,
      ctaHref: "/notifications",
      ctaLabel: "동의하러 가기",
    },
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
    "알림 채널 해제, 마케팅/이벤트 수신 해제, 리뷰 삭제 시 해당 추첨권은 차감됩니다.",
    "무성의한 리뷰, 동일 문구 반복, 광고성 리뷰, 운영 취지에 맞지 않는 리뷰는 운영진 판단에 따라 인정 제외될 수 있습니다.",
    "당첨은 1인 1회로 제한됩니다.",
  ],
};
