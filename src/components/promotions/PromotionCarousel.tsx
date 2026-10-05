"use client";

import PlainImage from "@/components/ui/PlainImage";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PauseIcon,
  PlayIcon,
} from "@heroicons/react/24/solid";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";
import CarouselSlideIndicators from "@/components/ui/CarouselSlideIndicators";
import { TOUCH_TARGET_HIT_AREA_CLASS_NAME } from "@/components/ui/touch-target";
import { useDocumentHidden } from "@/hooks/useDocumentHidden";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { getCachedImageUrl } from "@/lib/image-cache";
import { trackProductEvent } from "@/lib/product-events";
import {
  PROMOTION_AUTOPLAY_INTERVAL_MS,
  getPromotionScrollBehavior,
  isPromotionPaused,
  shouldAutoplayPromotion,
} from "@/lib/promotions/autoplay";
import type { PromotionSlide } from "@/lib/promotions/catalog";

function isInlineImageSrc(src: string) {
  return src.startsWith("blob:") || src.startsWith("data:");
}

function isKeyboardFocus(element: EventTarget | null) {
  if (!(element instanceof Element)) {
    return false;
  }
  try {
    return element.matches(":focus-visible");
  } catch {
    return true;
  }
}

export default function PromotionCarousel({
  slides,
  headingLevel = "h2",
  fullBleed = false,
  className,
}: {
  slides: PromotionSlide[];
  headingLevel?: "h1" | "h2";
  fullBleed?: boolean;
  className?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [userPaused, setUserPaused] = useState<boolean | null>(null);
  const [keyboardFocusWithin, setKeyboardFocusWithin] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();
  const documentHidden = useDocumentHidden();
  const slideCount = slides.length;
  const paused = isPromotionPaused(userPaused, prefersReducedMotion);
  const autoplay = shouldAutoplayPromotion({
    slideCount,
    userPaused,
    prefersReducedMotion,
    keyboardFocusWithin,
    documentHidden,
  });
  const scrollBehavior = getPromotionScrollBehavior(prefersReducedMotion);
  const Heading = headingLevel;

  const activeSlide = slides[activeIndex] ?? slides[0];
  const indicatorLabels = useMemo(() => slides.map((slide) => slide.title), [slides]);

  const scrollToIndex = useCallback((index: number) => {
    const node = scrollerRef.current;
    if (!node) {
      return;
    }
    node.scrollTo({
      left: node.clientWidth * index,
      behavior: scrollBehavior,
    });
  }, [scrollBehavior]);

  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) {
      return;
    }

    let frame = 0;
    const updateIndex = () => {
      frame = 0;
      const width = node.clientWidth || 1;
      setActiveIndex(
        Math.max(0, Math.min(slideCount - 1, Math.round(node.scrollLeft / width))),
      );
    };

    const handleScroll = () => {
      if (frame) {
        return;
      }
      frame = window.requestAnimationFrame(updateIndex);
    };

    updateIndex();
    node.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      node.removeEventListener("scroll", handleScroll);
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [slideCount]);

  useEffect(() => {
    if (!autoplay) {
      return;
    }

    const timer = window.setInterval(() => {
      scrollToIndex((activeIndex + 1) % slideCount);
    }, PROMOTION_AUTOPLAY_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [activeIndex, autoplay, scrollToIndex, slideCount]);

  if (slideCount === 0) {
    return null;
  }

  return (
    <section
      id="events"
      className={cn(
        "relative scroll-mt-24",
        fullBleed
          ? "left-1/2 mt-0 w-screen -translate-x-1/2"
          : "mt-5",
        className,
      )}
      aria-roledescription="carousel"
      aria-label="광고 캐러셀"
      onFocus={(event) => {
        if (isKeyboardFocus(event.target)) {
          setKeyboardFocusWithin(true);
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setKeyboardFocusWithin(false);
        }
      }}
    >
      <Heading className="sr-only">{activeSlide.title}</Heading>

      <div className="relative">
        <div
          ref={scrollerRef}
          className="flex min-w-0 snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {slides.map((slide, index) => (
            <Link
              key={slide.id}
              href={slide.href}
              className="block min-w-full snap-start focus-visible:outline-hidden focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-ring"
              aria-label={slide.title}
              onClick={() =>
                trackProductEvent({
                  eventName: "home_banner_click",
                  targetType: slide.adCampaignId ? "ad_campaign" : "home_banner",
                  targetId: slide.adCampaignId ?? slide.id,
                  properties: {
                    slideId: slide.id,
                    campaignId: slide.adCampaignId ?? null,
                    sponsorLabel: slide.sponsorLabel ?? "",
                  },
                })
              }
            >
              <div
                data-promotion-carousel-media
                className="relative aspect-[21/9] w-full overflow-hidden bg-surface-muted"
              >
                {slide.sponsorLabel ? (
                  <span className="absolute left-3 top-3 z-10 rounded-full border border-white/25 bg-black/70 px-3 py-1.5 text-xs font-semibold text-white shadow-flat backdrop-blur-md">
                    스폰서 · {slide.sponsorLabel}
                  </span>
                ) : null}
                {isInlineImageSrc(slide.imageSrc) ? (
                  <PlainImage
                    src={slide.imageSrc}
                    alt={slide.imageAlt}
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                ) : (
                  <Image
                    src={getCachedImageUrl(slide.imageSrc)}
                    alt={slide.imageAlt}
                    fill
                    sizes={
                      fullBleed
                        ? "100vw"
                        : "(min-width: 1024px) 50vw, calc(100vw - 64px)"
                    }
                    priority={index === 0}
                    className="object-cover"
                  />
                )}
              </div>
            </Link>
          ))}
        </div>

      </div>

      {slideCount > 1 ? (
        <div className="absolute inset-x-0 bottom-3 z-10 flex items-center justify-center px-4">
          <div className="flex items-center gap-3 rounded-full border border-white/25 bg-black/35 px-3 py-2 shadow-flat backdrop-blur-md">
            <button
              type="button"
              data-promotion-carousel-pause
              className={cn(
                "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white transition hover:bg-white/15 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white",
                TOUCH_TARGET_HIT_AREA_CLASS_NAME,
              )}
              aria-label="광고 자동 재생 일시정지"
              aria-pressed={paused}
              onClick={() => setUserPaused(!paused)}
            >
              {paused ? (
                <PlayIcon className="size-4" aria-hidden="true" />
              ) : (
                <PauseIcon className="size-4" aria-hidden="true" />
              )}
            </button>

            <CarouselSlideIndicators
              labels={indicatorLabels}
              activeIndex={activeIndex}
              onSelect={scrollToIndex}
            />

            <p className="hidden min-w-10 text-center text-xs font-semibold text-white md:block">
              {activeIndex + 1} / {slideCount}
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
