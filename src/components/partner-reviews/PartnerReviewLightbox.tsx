"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeftIcon, ChevronRightIcon, XMarkIcon } from "@heroicons/react/24/outline";
import Button from "@/components/ui/Button";

export default function PartnerReviewLightbox({
  images,
  initialIndex,
  onClose,
}: {
  images: string[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const canNavigate = images.length > 1;
  const activeImage = images[index] ?? images[0] ?? "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-sm">
      <div className="grid w-full max-w-5xl gap-4">
        <div className="flex justify-end">
          <Button variant="ghost" size="icon" onClick={onClose} ariaLabel="닫기">
            <XMarkIcon className="h-5 w-5 text-white" />
          </Button>
        </div>

        <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-black">
          <div className="relative aspect-square w-full">
            {activeImage ? (
              <Image
                src={activeImage}
                alt=""
                fill
                sizes="90vw"
                className="object-contain"
                unoptimized
              />
            ) : null}
          </div>
        </div>

        {canNavigate ? (
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="secondary"
              size="icon"
              onClick={() => setIndex((prev) => (prev - 1 + images.length) % images.length)}
              ariaLabel="이전 이미지"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </Button>
            <span className="text-sm text-white">
              {index + 1} / {images.length}
            </span>
            <Button
              variant="secondary"
              size="icon"
              onClick={() => setIndex((prev) => (prev + 1) % images.length)}
              ariaLabel="다음 이미지"
            >
              <ChevronRightIcon className="h-5 w-5" />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
