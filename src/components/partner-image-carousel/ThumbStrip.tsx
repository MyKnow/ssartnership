import Image from "next/image";
import { cn } from "@/lib/cn";

export default function ThumbStrip({
  images,
  activeIndex,
  activeThumbRef,
  thumbStripRef,
  onSelect,
}: {
  images: string[];
  activeIndex: number;
  activeThumbRef: React.RefObject<HTMLButtonElement | null>;
  thumbStripRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (index: number) => void;
}) {
  return (
    <div
      ref={thumbStripRef}
      className="flex gap-2 overflow-x-auto overscroll-contain px-3 pb-6 pt-2 xl:h-full xl:min-h-0 xl:flex-col xl:items-center xl:gap-3 xl:overflow-y-auto xl:overflow-x-visible xl:px-3 xl:py-2"
    >
      {images.map((image, index) => (
        <button
          ref={index === activeIndex ? activeThumbRef : null}
          key={`${image}-${index}`}
          type="button"
          className={cn(
            "relative h-16 w-20 flex-shrink-0 overflow-hidden rounded-2xl border transition-all duration-300 ease-out xl:h-20 xl:w-20",
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
            width={80}
            height={64}
            className="h-full w-full object-cover"
            sizes="80px"
            unoptimized
            loading="eager"
          />
        </button>
      ))}
    </div>
  );
}

