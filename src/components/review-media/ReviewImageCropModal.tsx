"use client";

import ImageCropDialog from "@/components/media/ImageCropDialog";
import { REVIEW_IMAGE_ASPECT_RATIO } from "@/lib/review-media";
import { isImageFile } from "@/components/review-media/shared";

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
      validateFile={(file) =>
        isImageFile(file) ? null : "이미지 파일만 업로드할 수 있습니다."
      }
      onCancel={onCancel}
      onApply={onApply}
    />
  );
}
