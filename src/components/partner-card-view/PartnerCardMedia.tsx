import Image from "next/image";
import { cn } from "@/lib/cn";
import { getBlurDataURL } from "@/lib/image-blur";
import { getCachedImageUrl, isProxiedCachedImageUrl } from "@/lib/image-cache";

export default function PartnerCardMedia({
  thumbnailUrl,
  compact = false,
}: {
  thumbnailUrl?: string | null;
  compact?: boolean;
}) {
  const cachedThumbnailUrl = getCachedImageUrl(thumbnailUrl ?? "");
  const blurDataURL = getBlurDataURL(32, 32);

  return (
    <div
      data-partner-card-media
      className={cn(
        "relative aspect-square shrink-0 overflow-hidden rounded-2xl border border-border bg-surface-muted",
        compact
          ? "h-full min-h-16 w-auto max-w-24 self-stretch"
          : "w-32 sm:w-36",
      )}
    >
      {cachedThumbnailUrl ? (
        <Image
          src={cachedThumbnailUrl}
          alt=""
          fill
          sizes={
            compact
              ? "(max-width: 389px) 64px, (max-width: 640px) 80px, 96px"
              : "(max-width: 640px) 128px, 144px"
          }
          className="object-cover"
          placeholder="blur"
          blurDataURL={blurDataURL}
          unoptimized={isProxiedCachedImageUrl(cachedThumbnailUrl)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          <svg
            width={28}
            height={28}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 16l4-4 4 4 4-4 5 5" />
            <circle cx="9" cy="9" r="2" />
          </svg>
        </div>
      )}
    </div>
  );
}
