import type { MouseEvent } from "react";
import Link from "next/link";
import Badge from "@/components/ui/Badge";
import PartnerValueBadge from "@/components/PartnerValueBadge";
import { cn } from "@/lib/cn";
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
  isActive,
  onCategoryClick,
  onTitleClick,
  headerAction,
  media,
  compact = false,
}: {
  partner: Partner;
  categoryLabel?: string;
  badgeStyle?: React.CSSProperties;
  detailHref: string;
  canNavigate: boolean;
  isActive: boolean;
  onCategoryClick?: (categoryKey: CategoryKey) => void;
  onTitleClick: (event: MouseEvent<HTMLAnchorElement>) => void;
  headerAction?: React.ReactNode;
  media: React.ReactNode;
  compact?: boolean;
}) {
  const handleCategoryClick = onCategoryClick
    ? (event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        onCategoryClick(partner.category);
      }
    : null;
  const categoryBadgeClass =
    "h-9 whitespace-nowrap px-2 py-0.5 text-xs font-medium tracking-[0.02em]";
  const categoryBadge = handleCategoryClick ? (
    <button
      type="button"
      onClick={handleCategoryClick}
      className="inline-flex h-11 min-w-11 items-center"
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
    <div
      className={cn(
        "min-w-0",
        compact
          ? "grid gap-2 min-[1200px]:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)] min-[1200px]:items-center min-[1200px]:gap-3"
          : "flex flex-col gap-4",
      )}
    >
      <div
        className={cn(
          "grid w-full min-w-0 gap-4 overflow-hidden @xs/card:items-start",
          compact
            ? "grid-cols-[5rem_minmax(0,1fr)] !items-start gap-2 min-[390px]:grid-cols-[6rem_minmax(0,1fr)] sm:gap-3"
            : "@xs/card:grid-cols-[minmax(8rem,9rem)_minmax(0,1fr)]",
        )}
      >
        {media}
        <div
          data-partner-card-primary-content
          className={cn(
            "grid min-w-0 flex-1",
            compact ? "h-full gap-1.5" : "gap-2",
          )}
        >
          <div
            className={cn(
              "flex min-w-0 items-start gap-3",
              compact ? "justify-start" : "justify-between",
            )}
          >
            <div
              className={cn(
                "flex min-w-0 flex-1 flex-wrap items-center overflow-hidden",
                compact ? "gap-1" : "gap-2",
              )}
            >
              {categoryBadge}
              {compact ? headerAction : null}
            </div>
            {!compact && headerAction ? (
              <div className="flex shrink-0 items-center gap-1.5">
                {headerAction}
              </div>
            ) : null}
          </div>
          <div className="flex min-w-0 items-center gap-2 overflow-hidden">
            {canNavigate ? (
              <Link
                href={detailHref}
                className={cn(
                  "min-w-0 flex-1 truncate text-left font-semibold leading-tight text-foreground hover:underline",
                  compact ? "text-base sm:text-lg" : "text-lg",
                )}
                aria-label={`${partner.name} 상세 보기${
                  isActive ? "" : " · 현재 이용할 수 없는 제휴"
                }`}
                onClick={onTitleClick}
              >
                {partner.name}
              </Link>
            ) : (
              <h3
                className={cn(
                  "min-w-0 flex-1 truncate font-semibold leading-tight text-foreground",
                  compact ? "text-base sm:text-lg" : "text-lg",
                )}
              >
                {partner.name}
              </h3>
            )}
          </div>
          {compact || !isOnlineService ? (
            <p
              data-partner-card-location
              className={cn(
                "min-w-0 text-muted-foreground",
                compact
                  ? "min-h-4 line-clamp-1 break-words text-xs leading-normal sm:min-h-5 sm:text-sm"
                  : "line-clamp-2 break-words text-sm leading-snug",
              )}
              title={compact && !isOnlineService ? partner.location : undefined}
              aria-hidden={compact && isOnlineService ? true : undefined}
            >
              {isOnlineService ? "\u00a0" : partner.location}
            </p>
          ) : null}
          {showBranchScopeBadge ? (
            <Badge variant="warning" className="w-fit">
              {branchScopeLabel}
            </Badge>
          ) : null}
        </div>
      </div>
      <div
        className={
          compact
            ? "hidden min-w-0 gap-3 min-[1200px]:grid"
            : "contents"
        }
      >
        <div className="min-w-0 text-sm text-foreground">
          <p className="font-medium text-foreground">혜택</p>
          <div className="mt-2 flex min-w-0 flex-wrap gap-2">
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
        <div className="min-w-0 text-sm text-foreground">
          <p className="font-medium text-foreground">적용 대상</p>
          <p className="mt-1.5 truncate text-sm text-muted-foreground">
            {audienceSummary || "대상 정보 없음"}
          </p>
        </div>
      </div>
    </div>
  );
}
