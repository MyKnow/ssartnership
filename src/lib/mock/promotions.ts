import { allowsLocalFixtures } from "@/lib/local-fixture-policy.mjs";
import type { PromotionSlide } from "@/lib/promotions/catalog";

type Environment = { NODE_ENV?: string; NEXT_PUBLIC_DATA_SOURCE?: string; E2E_MOCK_MUTATIONS?: string };

// Keep carousel coverage independent of expired campaigns and removed defaults.
// The normal production policy never allows this synthetic fallback.
export function localPromotionFixtures(environment: Environment = process.env): PromotionSlide[] {
  if (!allowsLocalFixtures(environment) || environment.NEXT_PUBLIC_DATA_SOURCE !== "mock" || environment.E2E_MOCK_MUTATIONS !== "1") return [];
  return [{
    id: "e2e-carousel-layout",
    title: "테스트용 제휴 안내",
    description: "격리 E2E의 캐러셀 배치 검증용 합성 데이터입니다.",
    imageSrc: "/ads/review-reward.svg",
    imageAlt: "테스트용 캐러셀 이미지",
    href: "/#benefits",
    audiences: ["guest", "student", "graduate", "staff"],
    allowedCampuses: [],
  }];
}
