"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import LightboxModal from "@/components/partner-image-carousel/LightboxModal";
import { clampCarouselZoom, normalizeCarouselIndex } from "@/components/partner-image-carousel/helpers";
import type { CarouselOffset } from "@/components/partner-image-carousel/types";

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
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<CarouselOffset>({ x: 0, y: 0 });
  const dragStartRef = useRef<CarouselOffset>({ x: 0, y: 0 });
  const offsetStartRef = useRef<CarouselOffset>({ x: 0, y: 0 });
  const portalRoot = typeof document === "undefined" ? null : document.body;
  const canNavigate = images.length > 1;
  const activeImage = images[index] ?? images[0] ?? "";

  useEffect(() => {
    setIndex(initialIndex);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [initialIndex]);

  useEffect(() => {
    if (!portalRoot) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [portalRoot]);

  const normalizedIndex = useMemo(
    () => normalizeCarouselIndex(index, images.length),
    [images.length, index],
  );

  useEffect(() => {
    setIndex(normalizedIndex);
  }, [normalizedIndex]);

  const activateImage = (nextIndex: number) => {
    setIndex(normalizeCarouselIndex(nextIndex, images.length));
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const handlePanStart = (x: number, y: number) => {
    dragStartRef.current = { x, y };
    offsetStartRef.current = { ...offset };
  };

  const handlePanMove = (x: number, y: number) => {
    const deltaX = x - dragStartRef.current.x;
    const deltaY = y - dragStartRef.current.y;
    setOffset({
      x: offsetStartRef.current.x + deltaX,
      y: offsetStartRef.current.y + deltaY,
    });
  };

  const handlePanEnd = () => {
    dragStartRef.current = { x: 0, y: 0 };
    offsetStartRef.current = { x: 0, y: 0 };
  };

  const handleZoomChange = (value: number | ((prev: number) => number)) => {
    setZoom((prev) => {
      const nextValue = typeof value === "function" ? value(prev) : value;
      return clampCarouselZoom(nextValue);
    });
  };

  if (!portalRoot) {
    return null;
  }

  return createPortal(
    <LightboxModal
      open
      canNavigate={canNavigate}
      activeImage={activeImage}
      name="리뷰 사진"
      zoom={zoom}
      offset={offset}
      onClose={onClose}
      onPrev={() => activateImage(index - 1)}
      onNext={() => activateImage(index + 1)}
      onZoomChange={handleZoomChange}
      onOffsetChange={setOffset}
      onPanStart={handlePanStart}
      onPanMove={handlePanMove}
      onPanEnd={handlePanEnd}
      fallback={<div />}
    />,
    portalRoot,
  );
}
