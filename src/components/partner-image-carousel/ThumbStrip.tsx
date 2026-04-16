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
      className={cn(
        "flex gap-2 overflow-x-auto overscroll-contain px-3 pb-6 pt-2",
        placement === "side"
          ? "xl:h-full xl:min-h-0 xl:flex-col xl:items-center xl:gap-3 xl:overflow-y-auto xl:overflow-x-visible xl:px-3 xl:py-2"
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
              ? "xl:w-full xl:max-w-[7.5rem]"
              : "xl:w-full xl:min-w-0",
            index === activeIndex
              ? "z-10 scale-[1.04] border-strong ring-2 ring-inset ring-strong/80 shadow-[0_4px_10px_rgba(0,0,0,0.48)] dark:shadow-[0_4px_10px_rgba(255,255,255,0.24)] xl:scale-[1.08]"
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
            loading="eager"
          />
        </button>
      ))}
    </div>
  );
}
