import type { MouseEvent } from "react";
import Link from "next/link";
import Badge from "@/components/ui/Badge";
import PartnerValueBadge from "@/components/PartnerValueBadge";
import { getPartnerServiceMode } from "@/lib/partner-service-mode";
import { getPartnerBranchScopeLabel } from "@/lib/partner-branch-registration";
import { getPartnerAudienceLabel } from "@/lib/partner-audience";
import { applyContentBudget } from "@/lib/content-budget";
import type { CategoryKey, Partner } from "@/lib/types";

export default function PartnerCardMeta({
  partner,
  categoryLabel,
  badgeStyle,
  detailHref,
  canNavigate,
  onCategoryClick,
  onTitleClick,
  headerAction,
  media,
}: {
  partner: Partner;
  categoryLabel?: string;
  badgeStyle?: React.CSSProperties;
  detailHref: string;
  canNavigate: boolean;
  onCategoryClick?: (categoryKey: CategoryKey) => void;
  onTitleClick: (event: MouseEvent<HTMLAnchorElement>) => void;
  headerAction?: React.ReactNode;
  media: React.ReactNode;
}) {
  const handleCategoryClick = onCategoryClick
    ? (event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        onCategoryClick(partner.category);
      }
    : null;
  const categoryBadgeClass = "min-h-8 px-2.5 py-1 text-[11px] font-medium tracking-[0.04em]";
  const categoryBadge = handleCategoryClick ? (
    <button
      type="button"
      onClick={handleCategoryClick}
      className="inline-flex min-h-10 min-w-10 items-center self-start"
      aria-label={`${categoryLabel ?? "카테고리"} 필터 적용`}
    >
      <Badge
        className={
          badgeStyle
            ? categoryBadgeClass
            : `${categoryBadgeClass} bg-surface-muted text-foreground`
        }
        style={badgeStyle}
      >
        {categoryLabel}
      </Badge>
    </button>
  ) : (
    <Badge
      className={
        badgeStyle
          ? categoryBadgeClass
          : `${categoryBadgeClass} bg-surface-muted text-foreground`
      }
      style={badgeStyle}
    >
      {categoryLabel}
    </Badge>
  );
  const serviceMode = getPartnerServiceMode(partner.location);
  const isOnlineService = serviceMode === "online";
  const branchScopeLabel = getPartnerBranchScopeLabel(
    partner.branchScopeType,
    serviceMode,
  );
  const showBranchScopeBadge =
    !isOnlineService && partner.branchScopeType && partner.branchScopeType !== "single_location";
  const benefitBudget = applyContentBudget(partner.benefits, 2);
  const audienceSummary = partner.appliesTo
    .map((audience) => getPartnerAudienceLabel(audience))
    .join(" · ");

  return (
    <div className="flex flex-col gap-4">
      <div className="grid min-w-0 gap-4 @xs/card:grid-cols-[minmax(8rem,9rem)_minmax(0,1fr)] @xs/card:items-start">
        {media}
        <div className="grid min-w-0 flex-1 gap-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              {categoryBadge}
            </div>
            {headerAction ? (
              <div className="flex shrink-0 items-center gap-1.5">
                {headerAction}
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {canNavigate ? (
              <Link
                href={detailHref}
                className="min-w-0 flex-1 truncate text-left text-lg font-semibold leading-tight text-foreground hover:underline"
                aria-label={`${partner.name} 상세 보기`}
                onClick={onTitleClick}
              >
                {partner.name}
              </Link>
            ) : (
              <h3 className="min-w-0 flex-1 truncate text-lg font-semibold leading-tight text-foreground">
                {partner.name}
              </h3>
            )}
          </div>
          {!isOnlineService ? (
            <p className="min-w-0 break-words text-sm leading-snug text-muted-foreground">
              {partner.location}
            </p>
          ) : null}
          {showBranchScopeBadge ? (
            <Badge variant="warning" className="w-fit">
              {branchScopeLabel}
            </Badge>
          ) : null}
        </div>
      </div>
      <div className="text-sm text-foreground">
        <p className="font-medium text-foreground">혜택</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {benefitBudget.visible.map((benefit) => (
            <PartnerValueBadge key={benefit}>
              {benefit}
            </PartnerValueBadge>
          ))}
          {benefitBudget.hiddenCount > 0 ? (
            <PartnerValueBadge>+{benefitBudget.hiddenCount}</PartnerValueBadge>
          ) : null}
        </div>
      </div>
      <div className="text-sm text-foreground">
        <p className="font-medium text-foreground">적용 대상</p>
        <p className="mt-1.5 truncate text-sm text-muted-foreground">
          {audienceSummary || "대상 정보 없음"}
        </p>
      </div>
    </div>
  );
}
