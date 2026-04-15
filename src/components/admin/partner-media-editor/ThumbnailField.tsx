"use client";

import MediaField from "@/components/admin/partner-media-editor/MediaField";
import { PARTNER_THUMBNAIL_ASPECT_RATIO } from "@/lib/partner-media";

export default function ThumbnailField({
  initial,
  className,
}: {
  initial?: string | null;
  className?: string;
}) {
  return (
    <MediaField
      role="thumbnail"
      title="메인 썸네일"
      subtitle="카드 목록에서 보일 1:1 이미지입니다."
      aspectRatio={PARTNER_THUMBNAIL_ASPECT_RATIO}
      initial={initial ? [initial] : []}
      className={className}
      multiple={false}
    />
  );
}
