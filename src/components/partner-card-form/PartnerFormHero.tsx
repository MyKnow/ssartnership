import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import {
  getPartnerVisibilityBadgeClass,
  getPartnerVisibilityLabel,
} from "@/lib/partner-visibility";
import type { PartnerCardFormMode } from "@/components/partner-card-form/types";

export default function PartnerFormHero({
  mode,
  visibilityValue,
  periodStart,
  periodEnd,
}: {
  mode: PartnerCardFormMode;
  visibilityValue: "public" | "confidential" | "private";
  periodStart: string;
  periodEnd: string;
}) {
  const heroTitle =
    mode === "create" ? "상세 페이지처럼 새 브랜드를 추가합니다" : "상세 페이지처럼 브랜드를 수정합니다";
  const heroDescription =
    mode === "create"
      ? "기본 정보, 썸네일, 갤러리, 조건과 혜택을 카드 단위로 나눠 입력하세요."
      : "기존 상세 페이지와 같은 흐름으로 내용을 갱신하세요.";
  const periodLabel =
    periodStart || periodEnd ? `${periodStart} ~ ${periodEnd}` : "기간 미설정";

  return (
    <Card className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(37,99,235,0.08),_transparent_42%),radial-gradient(circle_at_bottom_left,_rgba(14,165,233,0.08),_transparent_45%)]"
      />
      <div className="relative flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="grid gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            {mode === "create" ? "새 브랜드 추가" : "브랜드 정보 수정"}
          </p>
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">
            {heroTitle}
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {heroDescription}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <Badge
            className={cn(
              "text-xs",
              getPartnerVisibilityBadgeClass(visibilityValue),
            )}
          >
            {getPartnerVisibilityLabel(visibilityValue)}
          </Badge>
          <span className="text-xs font-medium text-muted-foreground">
            {periodLabel}
          </span>
        </div>
      </div>
    </Card>
  );
}
