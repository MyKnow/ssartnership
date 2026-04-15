export function clampCarouselZoom(value: number) {
  return Math.min(4, Math.max(1, value));
}

export function normalizeCarouselIndex(nextIndex: number, imageCount: number) {
  if (imageCount <= 0) {
    return 0;
  }
  return (nextIndex + imageCount) % imageCount;
}

export function getTouchDistance(
  a: { clientX: number; clientY: number },
  b: { clientX: number; clientY: number },
) {
  const dx = a.clientX - b.clientX;
  const dy = a.clientY - b.clientY;
  return Math.hypot(dx, dy);
}

