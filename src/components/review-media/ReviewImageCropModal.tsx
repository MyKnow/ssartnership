"use client";

import ImageCropDialog from "@/components/media/ImageCropDialog";
import { REVIEW_IMAGE_ASPECT_RATIO } from "@/lib/review-media";
import { resolveImageTransformPolicy } from "@/lib/image-upload/policy";

const REVIEW_IMAGE_POLICY = resolveImageTransformPolicy("review", "image");

export default function ReviewImageCropModal({
  open,
  sourceUrl,
  sourceFile,
  outputName,
  onCancel,
  onApply,
}: {
  open: boolean;
  sourceUrl: string;
  sourceFile?: File;
  outputName: string;
  onCancel: () => void;
  onApply: (file: File) => void;
}) {
  return (
    <ImageCropDialog
      open={open}
      aspectRatio={REVIEW_IMAGE_ASPECT_RATIO}
      sourceUrl={sourceUrl}
      sourceFile={sourceFile}
      outputName={outputName}
      outputWidth={REVIEW_IMAGE_POLICY.width}
      outputHeight={REVIEW_IMAGE_POLICY.height}
      policy={REVIEW_IMAGE_POLICY}
      onCancel={onCancel}
      onApply={onApply}
    />
  );
}
