"use client";

import ImageCropDialog from "@/components/media/ImageCropDialog";
import {
  resolveImageTransformPolicy,
  type ImageUploadPurpose,
} from "@/lib/image-upload/policy";

function getOutputDimensions(aspectRatio: number) {
  if (Math.abs(aspectRatio - 1) < 0.01) {
    return { width: 1200, height: 1200 };
  }
  if (Math.abs(aspectRatio - 4 / 3) < 0.01) {
    return { width: 1600, height: 1200 };
  }
  if (Math.abs(aspectRatio - 21 / 9) < 0.02) {
    return { width: 2100, height: 900 };
  }

  const width = 1600;
  return { width, height: Math.max(1, Math.round(width / aspectRatio)) };
}

export default function MediaCropModal({
  open,
  aspectRatio,
  sourceUrl,
  sourceFile,
  outputName,
  purpose,
  role,
  onCancel,
  onApply,
}: {
  open: boolean;
  aspectRatio: number;
  sourceUrl: string;
  sourceFile?: File;
  outputName: string;
  purpose?: ImageUploadPurpose;
  role?: "thumbnail" | "gallery" | "slide";
  onCancel: () => void;
  onApply: (file: File) => void;
}) {
  const policy = purpose && role
    ? resolveImageTransformPolicy(purpose, role)
    : undefined;
  const { width, height } = policy ?? getOutputDimensions(aspectRatio);

  return (
    <ImageCropDialog
      open={open}
      aspectRatio={aspectRatio}
      sourceUrl={sourceUrl}
      sourceFile={sourceFile}
      outputName={outputName}
      outputWidth={width}
      outputHeight={height}
      policy={policy}
      onCancel={onCancel}
      onApply={onApply}
    />
  );
}
