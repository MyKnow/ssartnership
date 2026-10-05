import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import PromotionCarousel from "@/components/promotions/PromotionCarousel";
import type { buildPromotionPreviewSlides } from "./slide-helpers";

export default function PromotionCarouselPreviewCard({
  previewSlides,
}: {
  previewSlides: ReturnType<typeof buildPromotionPreviewSlides>;
}) {
  return (
    <Card tone="elevated" className="grid gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="ui-kicker">미리보기</p>
          <h2 className="mt-2 text-xl font-semibold text-foreground">
            홈 캐러셀 미리보기
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            드래프트가 바로 반영되며, 저장 전까지는 로컬에서만 보입니다.
          </p>
        </div>
        <Button href="/" variant="secondary" className="w-full sm:w-auto">
          홈에서 보기
        </Button>
      </div>
      {previewSlides.length > 0 ? (
        <PromotionCarousel slides={previewSlides} className="mt-0" />
      ) : (
        <div className="rounded-overlay border border-dashed border-border bg-surface-inset px-4 py-10 text-center text-sm font-medium text-muted-foreground">
          활성 광고 카드가 없습니다. 카드를 활성화하면 실제 홈 배너와 같은
          기준으로 미리볼 수 있습니다.
        </div>
      )}
    </Card>
  );
}
