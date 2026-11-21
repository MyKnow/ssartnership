import PromotionCarousel from "@/components/promotions/PromotionCarousel";
import { cn } from "@/lib/cn";
import type { PromotionSlide } from "@/lib/promotions/catalog";

/**
 * Streams the home carousel so the page shell does not wait for the slide
 * lookup. The fallback keeps the carousel box (21:9) to avoid layout shift.
 */
export default async function HomePromotionCarousel({
  slidesPromise,
  className,
}: {
  slidesPromise: Promise<PromotionSlide[]>;
  className?: string;
}) {
  const slides = await slidesPromise;
  return (
    <PromotionCarousel slides={slides} headingLevel="h1" className={className} />
  );
}

export function HomePromotionCarouselFallback({
  className,
}: {
  className?: string;
}) {
  return (
    <section
      aria-hidden="true"
      data-home-promotion-fallback
      className={cn("relative mt-5", className)}
    >
      <div className="aspect-[21/9] w-full animate-pulse bg-surface-muted motion-reduce:animate-none" />
    </section>
  );
}
