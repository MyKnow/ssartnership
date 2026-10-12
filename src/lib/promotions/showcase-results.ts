type ShowcaseResultSlide = { href: string };

/** Reorder visible slides only. Managed content must remain exactly as saved by the operator. */
export function promoteShowcaseResultsSlide<T extends ShowcaseResultSlide>(slides: readonly T[], available: boolean): T[] {
  if (!available) return [...slides];
  const showcase = slides.filter((slide) => slide.href === "/events/project-showcase");
  return [...showcase, ...slides.filter((slide) => slide.href !== "/events/project-showcase")];
}
