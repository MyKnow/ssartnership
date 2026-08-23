"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PauseIcon,
  PlayIcon,
} from "@heroicons/react/24/solid";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { trackProductEvent } from "@/lib/product-events";
import type { PromotionSlide } from "@/lib/promotions/catalog";

function isInlineImageSrc(src: string) {
  return src.startsWith("blob:") || src.startsWith("data:");
}

function isRemoteImageSrc(src: string) {
  return /^https?:\/\//.test(src);
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
  const [paused, setPaused] = useState(false);
  const slideCount = slides.length;
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
      behavior: "smooth",
    });
  }, []);

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
    if (paused || slideCount < 2) {
      return;
    }

    const timer = window.setInterval(() => {
      scrollToIndex((activeIndex + 1) % slideCount);
    }, 6500);

    return () => window.clearInterval(timer);
  }, [activeIndex, paused, scrollToIndex, slideCount]);

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
              className="block min-w-full snap-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
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
                  // eslint-disable-next-line @next/next/no-img-element -- live preview and blob URLs need plain img
                  <img
                    src={slide.imageSrc}
                    alt={slide.imageAlt}
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                ) : (
                  <Image
                    src={slide.imageSrc}
                    alt={slide.imageAlt}
                    fill
                    sizes={
                      fullBleed
                        ? "100vw"
                        : "(min-width: 1024px) 50vw, calc(100vw - 64px)"
                    }
                    priority={index === 0}
                    unoptimized={isRemoteImageSrc(slide.imageSrc)}
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
              className="hidden h-8 w-8 items-center justify-center rounded-full text-white transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 md:inline-flex"
              aria-label={paused ? "광고 자동 재생" : "광고 자동 재생 일시정지"}
              onClick={() => setPaused((current) => !current)}
            >
              {paused ? (
                <PlayIcon className="size-4" aria-hidden="true" />
              ) : (
                <PauseIcon className="size-4" aria-hidden="true" />
              )}
            </button>

            <div className="flex items-center gap-2">
              {slides.map((slide, index) => (
                <button
                  key={slide.id}
                  type="button"
                  className={cn(
                    "h-2.5 rounded-full transition-all",
                    activeIndex === index
                      ? "w-7 bg-white"
                      : "w-2.5 bg-white/45 hover:bg-white/70",
                  )}
                  aria-label={indicatorLabels[index]}
                  aria-pressed={activeIndex === index}
                  onClick={() => scrollToIndex(index)}
                />
              ))}
            </div>

            <p className="hidden min-w-10 text-center text-xs font-semibold text-white md:block">
              {activeIndex + 1} / {slideCount}
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
