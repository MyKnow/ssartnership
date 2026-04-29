import type { Metadata } from "next";
import AdminShell from "@/components/admin/AdminShell";
import PromotionCarouselEditor from "@/components/admin/promotion-carousel-editor/PromotionCarouselEditor";
import FormMessage from "@/components/ui/FormMessage";
import SectionHeading from "@/components/ui/SectionHeading";
import ShellHeader from "@/components/ui/ShellHeader";
import StatsRow from "@/components/ui/StatsRow";
import { savePromotionSlidesAction } from "@/app/admin/(protected)/_actions/promotion-actions";
import { listManagedPromotionSlides } from "@/lib/promotions/events";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `홈 광고 관리 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: false,
  },
};

function statusMessage(status?: string) {
  if (status === "updated") {
    return "광고 카드를 저장했습니다.";
  }
  return null;
}

export default async function AdminAdvertisementPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const message = statusMessage(params.status);
  const slides = await listManagedPromotionSlides({ includeInactive: true });
  const activeSlides = slides.filter((slide) => slide.isActive).length;
  const databaseSlides = slides.filter((slide) => slide.source === "database").length;
  const catalogSlides = slides.filter((slide) => slide.source === "catalog").length;

  return (
    <AdminShell title="홈 광고 관리" backHref="/admin" backLabel="관리 홈">
      <div className="grid gap-6">
        <ShellHeader
          eyebrow="Advertisement"
          title="홈 광고 관리"
          description="홈 캐러셀 카드의 순서, 이미지, 문구, 연결 페이지, 노출 권한을 한 번에 편집합니다."
        />
        <StatsRow
          items={[
            { label: "전체 카드", value: `${slides.length}개`, hint: "운영 중인 광고 카드" },
            { label: "활성 카드", value: `${activeSlides}개`, hint: "홈 노출 기준" },
            { label: "편집 가능", value: `${databaseSlides}개`, hint: "DB 기반 카드" },
            { label: "카탈로그", value: `${catalogSlides}개`, hint: "코드 정의 카드" },
          ]}
          minItemWidth="13rem"
        />
        {message ? (
          <FormMessage variant="info">{message}</FormMessage>
        ) : null}
        <section className="grid gap-4">
          <SectionHeading
            title="캐러셀 편집기"
            description="메인 미리보기와 카드별 상세 편집을 같은 워크스페이스에서 다룹니다."
          />
          <PromotionCarouselEditor initialSlides={slides} saveAction={savePromotionSlidesAction} />
        </section>
      </div>
    </AdminShell>
  );
}
