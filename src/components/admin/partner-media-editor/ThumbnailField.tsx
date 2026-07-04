"use client";

import MediaField from "@/components/admin/partner-media-editor/MediaField";
import { PARTNER_THUMBNAIL_ASPECT_RATIO } from "@/lib/partner-media";

export default function ThumbnailField({
  initial,
  className,
  title = "메인 썸네일",
  subtitle = "카드 목록에서 보일 1:1 이미지입니다.",
  allowUrl,
  accept,
  validateFile,
}: {
  initial?: string | null;
  className?: string;
  title?: string;
  subtitle?: string;
  allowUrl?: boolean;
  accept?: string;
  validateFile?: (file: File) => string | null;
}) {
  return (
    <MediaField
      role="thumbnail"
      title={title}
      subtitle={subtitle}
      aspectRatio={PARTNER_THUMBNAIL_ASPECT_RATIO}
      initial={initial ? [initial] : []}
      className={className}
      multiple={false}
      allowUrl={allowUrl}
      accept={accept}
      validateFile={validateFile}
    />
  );
}
