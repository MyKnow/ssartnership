import Image from "next/image";
import { getBlurDataURL } from "@/lib/image-blur";
import { getCachedImageUrl } from "@/lib/image-cache";

export default function PartnerCardMedia({
  thumbnailUrl,
}: {
  thumbnailUrl?: string | null;
}) {
  const cachedThumbnailUrl = getCachedImageUrl(thumbnailUrl ?? "");
  const blurDataURL = getBlurDataURL(32, 32);

  return (
    <div className="relative aspect-square w-28 shrink-0 overflow-hidden rounded-2xl border border-border bg-surface-muted">
      {cachedThumbnailUrl ? (
        <Image
          src={cachedThumbnailUrl}
          alt=""
          fill
          sizes="112px"
          className="object-cover"
          placeholder="blur"
          blurDataURL={blurDataURL}
          unoptimized
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

