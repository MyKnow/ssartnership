"use client";

import { getClientIntermediateWebpQualities } from "@/lib/image-upload/policy";

function canvasToWebpBlob(canvas: HTMLCanvasElement, quality: number, failureMessage: string) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (nextBlob) => {
        if (!nextBlob) {
          reject(new Error(failureMessage));
          return;
        }
        resolve(nextBlob);
      },
      "image/webp",
      quality,
    );
  });
}

/**
 * 서버 재인코딩 전 중간 WebP를 만든다. 높은 품질로 먼저 인코딩하고, 원본 용량 상한(maxBytes)을
 * 넘을 때만 최종 정책 품질로 다시 인코딩해 2세대 손실을 기본 경로에서 없앤다.
 */
export async function encodeCanvasAsIntermediateWebp(
  canvas: HTMLCanvasElement,
  input: { finalQuality: number; maxBytes?: number; failureMessage: string },
) {
  const qualities = getClientIntermediateWebpQualities(input.finalQuality);
  let blob: Blob | null = null;
  for (const quality of qualities) {
    blob = await canvasToWebpBlob(canvas, quality, input.failureMessage);
    if (!input.maxBytes || blob.size <= input.maxBytes) {
      return blob;
    }
  }
  if (!blob) {
    throw new Error(input.failureMessage);
  }
  return blob;
}
