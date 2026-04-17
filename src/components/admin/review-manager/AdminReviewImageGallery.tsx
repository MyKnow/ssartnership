"use client";

import { useState } from "react";
import Image from "next/image";
import PartnerReviewLightbox from "../../partner-reviews/PartnerReviewLightbox";

export default function AdminReviewImageGallery({
  images,
}: {
  images: string[];
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (images.length === 0) {
    return null;
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-6">
        {images.map((image, index) => (
          <button
            key={`${image}-${index}`}
            type="button"
            className="relative aspect-square overflow-hidden rounded-[1rem] border border-border bg-surface-muted"
            onClick={() => setLightboxIndex(index)}
            aria-label={`리뷰 사진 ${index + 1} 크게 보기`}
          >
            <Image
              src={image}
              alt={`리뷰 사진 ${index + 1}`}
              fill
              sizes="(max-width: 640px) 33vw, 160px"
              className="object-cover"
              unoptimized
            />
          </button>
        ))}
      </div>

      {lightboxIndex !== null ? (
        <PartnerReviewLightbox
          images={images}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      ) : null}
    </>
  );
}
