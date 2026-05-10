"use client";

import MediaField from "@/components/admin/partner-media-editor/MediaField";
import { PARTNER_GALLERY_ASPECT_RATIO } from "@/lib/partner-media";

export default function GalleryField({
  initial,
  className,
}: {
  initial?: string[];
  className?: string;
}) {
  return (
    <MediaField
      role="gallery"
      title="추가 이미지"
      subtitle="상세 페이지에서 보일 4:3 이미지들입니다. URL은 줄바꿈 또는 | 로 여러 개를 한 번에 추가할 수 있습니다."
      aspectRatio={PARTNER_GALLERY_ASPECT_RATIO}
      initial={initial ?? []}
      className={className}
      multiple
    />
  );
}
