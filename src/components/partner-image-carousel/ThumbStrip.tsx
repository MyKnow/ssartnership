import Image from "next/image";
import { cn } from "@/lib/cn";
import type { CarouselThumbPlacement } from "./types";

export default function ThumbStrip({
  images,
  activeIndex,
  placement,
  activeThumbRef,
  thumbStripRef,
  onSelect,
}: {
  images: string[];
  activeIndex: number;
  placement: CarouselThumbPlacement;
  activeThumbRef: React.RefObject<HTMLButtonElement | null>;
  thumbStripRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (index: number) => void;
}) {
  return (
    <div
      ref={thumbStripRef}
      data-partner-image-thumbnail-rail={placement}
      className={cn(
        "flex gap-2 overflow-x-auto overscroll-contain px-3 pb-6 pt-2",
        placement === "side"
          ? "md:h-[var(--partner-image-carousel-main-height)] md:max-h-[var(--partner-image-carousel-main-height)] md:min-h-0 md:flex-col md:items-center md:gap-3 md:overflow-x-hidden md:overflow-y-auto md:px-3 md:py-2"
          : "xl:grid xl:grid-cols-4 xl:gap-3 xl:overflow-visible xl:px-0 xl:pb-0 xl:pt-0",
      )}
    >
      {images.map((image, index) => (
        <button
          ref={index === activeIndex ? activeThumbRef : null}
          key={`${image}-${index}`}
          type="button"
          className={cn(
            "relative aspect-[4/3] w-20 flex-shrink-0 overflow-hidden rounded-2xl border transition-all duration-300 ease-out sm:w-24",
            placement === "side"
              ? "md:w-full"
              : "xl:w-full xl:min-w-0",
            index === activeIndex
              ? "z-10 scale-[1.04] border-strong ring-2 ring-inset ring-strong/80 shadow-[0_4px_10px_rgba(0,0,0,0.48)] dark:shadow-[0_4px_10px_rgba(255,255,255,0.24)] md:scale-[1.08]"
              : "border-border hover:border-strong/70",
          )}
          onClick={() => onSelect(index)}
          aria-pressed={index === activeIndex}
          aria-label={`이미지 ${index + 1}`}
        >
          <Image
            src={images[index]}
            alt=""
            width={160}
            height={120}
            className="h-full w-full object-cover"
            sizes={placement === "side" ? "120px" : "(min-width: 1280px) 15vw, 96px"}
            unoptimized
            loading={index === activeIndex ? "eager" : "lazy"}
            fetchPriority={index === activeIndex ? "auto" : "low"}
          />
        </button>
      ))}
    </div>
  );
}
