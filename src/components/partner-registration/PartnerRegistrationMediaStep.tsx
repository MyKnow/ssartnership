import {
  PartnerGalleryField,
  PartnerThumbnailField,
} from "@/components/admin/PartnerMediaEditor";
import {
  PARTNER_REGISTRATION_GALLERY_MAX_FILES,
  PARTNER_REGISTRATION_IMAGE_ACCEPT,
  validatePartnerRegistrationImageFile,
} from "@/lib/partner-registration";

export default function PartnerRegistrationMediaStep({
  active,
}: {
  active: boolean;
}) {
  return (
    <section
      hidden={!active}
      className="grid min-w-0 gap-4 border-t border-border/70 pt-5"
    >
      <div className="min-w-0">
        <h2 className="truncate text-base font-semibold text-foreground">
          제휴처 이미지
        </h2>
        <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
          대표 이미지와 상세 이미지는 JPG, PNG, WebP, AVIF만 업로드할 수 있습니다.
        </p>
      </div>
      <div className="grid min-w-0 gap-5">
        <PartnerThumbnailField
          title="대표 이미지"
          subtitle="제휴처 목록에서 보일 1:1 이미지입니다."
          allowUrl={false}
          accept={PARTNER_REGISTRATION_IMAGE_ACCEPT}
          validateFile={validatePartnerRegistrationImageFile}
        />
        <PartnerGalleryField
          title="추가 이미지"
          subtitle="상세 페이지에서 보일 4:3 이미지입니다. 최대 5장까지 업로드합니다."
          allowUrl={false}
          accept={PARTNER_REGISTRATION_IMAGE_ACCEPT}
          maxItems={PARTNER_REGISTRATION_GALLERY_MAX_FILES}
          validateFile={validatePartnerRegistrationImageFile}
        />
      </div>
    </section>
  );
}
