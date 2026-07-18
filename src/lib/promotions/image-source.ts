/**
 * A persisted carousel card may retain only its currently stored image unless
 * it provides a completed common-image upload ID. This prevents forged form
 * JSON from adding a new external URL directly to a public promotion record.
 */
export function assertPromotionSlideImageSource({
  imageSrc,
  existingImageSrc,
  uploadId,
}: {
  imageSrc: string;
  existingImageSrc?: string | null;
  uploadId?: string | null;
}) {
  if (uploadId) return;
  if (!existingImageSrc || imageSrc !== existingImageSrc) {
    throw new Error("기존에 저장된 이미지 외에는 이미지 URL을 직접 제출할 수 없습니다.");
  }
}
