"use client";

import ImageCropDialog from "@/components/media/ImageCropDialog";

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
  title,
  subtitle,
  aspectRatio,
  sourceUrl,
  outputName,
  queueCount = 1,
  accept,
  validateFile,
  onCancel,
  onApply,
}: {
  open: boolean;
  title: string;
  subtitle: string;
  aspectRatio: number;
  sourceUrl: string;
  outputName: string;
  queueCount?: number;
  accept?: string;
  validateFile?: (file: File) => string | null;
  onCancel: () => void;
  onApply: (file: File) => void;
}) {
  const { width, height } = getOutputDimensions(aspectRatio);

  return (
    <ImageCropDialog
      open={open}
      title={title}
      subtitle={subtitle}
      aspectRatio={aspectRatio}
      sourceUrl={sourceUrl}
      outputName={outputName}
      outputWidth={width}
      outputHeight={height}
      queueCount={queueCount}
      accept={accept}
      validateFile={validateFile}
      onCancel={onCancel}
      onApply={onApply}
    />
  );
}
