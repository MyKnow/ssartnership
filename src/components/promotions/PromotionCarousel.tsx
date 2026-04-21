"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PauseIcon,
  PlayIcon,
} from "@heroicons/react/24/solid";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";
import type { PromotionSlide } from "@/lib/promotions/catalog";

function isInlineImageSrc(src: string) {
  return src.startsWith("blob:") || src.startsWith("data:");
}

export default function PromotionCarousel({
  slides,
  headingLevel = "h2",
  className,
}: {
  slides: PromotionSlide[];
  headingLevel?: "h1" | "h2";
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

  function scrollPrev() {
    scrollToIndex((activeIndex - 1 + slideCount) % slideCount);
  }

  function scrollNext() {
    scrollToIndex((activeIndex + 1) % slideCount);
  }

  return (
    <section
      className={cn("relative mt-5", className)}
      aria-roledescription="carousel"
      aria-label="광고 캐러셀"
    >
      <div className="mb-4 flex flex-col gap-2 px-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Heading className="text-2xl font-semibold tracking-[-0.03em] text-foreground sm:text-1xl">
            {activeSlide.title}
          </Heading>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          {activeSlide.description}
        </p>
      </div>

      <div className="relative">
        <button
          type="button"
          className="absolute left-0 top-1/2 z-10 hidden h-12 w-12 -translate-x-[calc(100%+1rem)] -translate-y-1/2 items-center justify-center rounded-full border border-border/70 bg-surface-control text-foreground shadow-[var(--shadow-raised)] transition hover:-translate-x-[calc(100%+1rem)] hover:-translate-y-[calc(50%+1px)] hover:border-strong hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background md:inline-flex"
          aria-label="이전 광고"
          onClick={scrollPrev}
        >
          <ChevronLeftIcon className="size-6" aria-hidden="true" />
        </button>

        <div
          ref={scrollerRef}
          className="flex min-w-0 snap-x snap-mandatory overflow-x-auto rounded-[var(--radius-overlay)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {slides.map((slide, index) => (
            <Link
              key={slide.id}
              href={slide.href}
              className="block min-w-full snap-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label={slide.title}
            >
              <div className="relative aspect-[21/9] w-full overflow-hidden rounded-[var(--radius-overlay)] border border-border/70 bg-surface-muted shadow-[var(--shadow-raised)]">
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
                    sizes="(min-width: 1280px) 1084px, calc(100vw - 32px)"
                    priority={index === 0}
                    className="object-cover"
                  />
                )}
              </div>
            </Link>
          ))}
        </div>

        <button
          type="button"
          className="absolute right-0 top-1/2 z-10 hidden h-12 w-12 translate-x-[calc(100%+1rem)] -translate-y-1/2 items-center justify-center rounded-full border border-border/70 bg-surface-control text-foreground shadow-[var(--shadow-raised)] transition hover:translate-x-[calc(100%+1rem)] hover:-translate-y-[calc(50%+1px)] hover:border-strong hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background md:inline-flex"
          aria-label="다음 광고"
          onClick={scrollNext}
        >
          <ChevronRightIcon className="size-6" aria-hidden="true" />
        </button>
      </div>

      <div className="absolute inset-x-0 bottom-3 z-10 flex items-center justify-center px-4">
        <div className="flex items-center gap-3 rounded-full border border-white/25 bg-black/35 px-3 py-2 shadow-[var(--shadow-flat)] backdrop-blur-md">
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
    </section>
  );
}
