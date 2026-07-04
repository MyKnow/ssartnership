"use client";

import ImageCropDialog from "@/components/media/ImageCropDialog";
import { REVIEW_IMAGE_ASPECT_RATIO } from "@/lib/review-media";

const REVIEW_IMAGE_OUTPUT_SIZE = 900;
const REVIEW_IMAGE_OUTPUT_QUALITY = 0.68;

export default function ReviewImageCropModal({
  open,
  sourceUrl,
  outputName,
  onCancel,
  onApply,
}: {
  open: boolean;
  sourceUrl: string;
  outputName: string;
  onCancel: () => void;
  onApply: (file: File) => void;
}) {
  return (
    <ImageCropDialog
      open={open}
      title="사진 조정"
      subtitle="정방형으로 저장됩니다."
      aspectRatio={REVIEW_IMAGE_ASPECT_RATIO}
      sourceUrl={sourceUrl}
      outputName={outputName}
      outputWidth={REVIEW_IMAGE_OUTPUT_SIZE}
      outputHeight={REVIEW_IMAGE_OUTPUT_SIZE}
      quality={REVIEW_IMAGE_OUTPUT_QUALITY}
      onCancel={onCancel}
      onApply={onApply}
    />
  );
}
