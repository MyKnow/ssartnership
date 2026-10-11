type ShowcaseResultSlide = { href: string; title: string; description: string; imageAlt: string; imageSrc: string };

/** Reorders only an already-visible slide, preserving audience and operator visibility rules. */
export function promoteShowcaseResultsSlide<T extends ShowcaseResultSlide>(slides: readonly T[], available: boolean): T[] {
  if (!available) return [...slides];
  const showcase = slides.filter((slide) => slide.href === "/events/project-showcase").map((slide) => ({
    ...slide,
    title: "프로젝트 리뷰·당첨 결과 확인",
    description: "내 출품작의 리뷰와 당첨 여부를 확인하세요. 경품 수령 폼은 10월 14일 18시까지 작성해 주세요.",
    imageAlt: "프로젝트 쇼케이스 종료 · 본인 리뷰와 당첨 결과 확인",
    imageSrc: "/ads/project-showcase-results.svg",
  }));
  return [...showcase, ...slides.filter((slide) => slide.href !== "/events/project-showcase")];
}
