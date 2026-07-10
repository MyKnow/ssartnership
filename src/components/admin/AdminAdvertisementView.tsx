import type { ComponentProps } from "react";
import AdminAdPackageManager from "@/components/admin/ad-packages/AdminAdPackageManager";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSectionHeading from "@/components/admin/AdminSectionHeading";
import PromotionCarouselEditor from "@/components/admin/promotion-carousel-editor/PromotionCarouselEditor";
import FormMessage from "@/components/ui/FormMessage";
import StatsRow from "@/components/ui/StatsRow";

type AdManagerProps = ComponentProps<typeof AdminAdPackageManager>;
type CarouselEditorProps = ComponentProps<typeof PromotionCarouselEditor>;

export type AdminAdvertisementViewProps = AdManagerProps &
  CarouselEditorProps & {
    message?: string | null;
  };

export default function AdminAdvertisementView({
  campaigns,
  partners,
  createCampaignAction,
  updateCampaignStatusAction,
  createCouponAction,
  initialSlides,
  eventPageOptions,
  adCampaignOptions,
  saveAction,
  message,
}: AdminAdvertisementViewProps) {
  const activeSlides = initialSlides.filter((slide) => slide.isActive).length;
  const databaseSlides = initialSlides.filter(
    (slide) => slide.source === "database",
  ).length;
  const catalogSlides = initialSlides.filter(
    (slide) => slide.source === "catalog",
  ).length;

  return (
    <div className="grid gap-6">
      <AdminPageHeader
        eyebrow="Advertisement"
        title="홈 광고 관리"
        description="홈 캐러셀 카드의 순서, 이미지, 문구, 연결 페이지, 노출 권한을 한 번에 편집합니다."
      />
      <StatsRow
        items={[
          { label: "전체 카드", value: `${initialSlides.length}개`, hint: "운영 중인 광고 카드" },
          { label: "활성 카드", value: `${activeSlides}개`, hint: "홈 노출 기준" },
          { label: "편집 가능", value: `${databaseSlides}개`, hint: "DB 기반 카드" },
          { label: "카탈로그", value: `${catalogSlides}개`, hint: "코드 정의 카드" },
        ]}
        minItemWidth="13rem"
      />
      {message ? <FormMessage variant="info">{message}</FormMessage> : null}
      <AdminAdPackageManager
        campaigns={campaigns}
        partners={partners}
        createCampaignAction={createCampaignAction}
        updateCampaignStatusAction={updateCampaignStatusAction}
        createCouponAction={createCouponAction}
      />
      <section className="grid gap-4">
        <AdminSectionHeading
          title="캐러셀 편집기"
          description="메인 미리보기와 카드별 상세 편집을 같은 워크스페이스에서 다룹니다."
        />
        <PromotionCarouselEditor
          initialSlides={initialSlides}
          eventPageOptions={eventPageOptions}
          adCampaignOptions={adCampaignOptions}
          saveAction={saveAction}
        />
      </section>
    </div>
  );
}
