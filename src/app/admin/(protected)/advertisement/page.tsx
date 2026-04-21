import type { Metadata } from "next";
import AdminShell from "@/components/admin/AdminShell";
import PromotionCarouselEditor from "@/components/admin/promotion-carousel-editor/PromotionCarouselEditor";
import FormMessage from "@/components/ui/FormMessage";
import ShellHeader from "@/components/ui/ShellHeader";
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

  return (
    <AdminShell title="홈 광고 관리" backHref="/admin" backLabel="관리 홈">
      <div className="grid gap-6">
        <ShellHeader
          eyebrow="Advertisement"
          title="홈 광고 관리"
          description="홈 캐러셀 카드의 순서, 이미지, 문구, 연결 페이지, 노출 권한을 한 번에 편집합니다."
        />
        {message ? (
          <FormMessage variant="info">{message}</FormMessage>
        ) : null}
        <PromotionCarouselEditor initialSlides={slides} saveAction={savePromotionSlidesAction} />
      </div>
    </AdminShell>
  );
}
