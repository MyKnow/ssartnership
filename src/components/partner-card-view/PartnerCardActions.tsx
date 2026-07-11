import { ArrowRightIcon } from "@heroicons/react/24/outline";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export default function PartnerCardActions({
  isActive,
  detailHref,
  canNavigate,
  compact = false,
  onDetailClick,
}: {
  isActive: boolean;
  detailHref: string;
  canNavigate: boolean;
  compact?: boolean;
  onDetailClick: () => void;
}) {
  const detailActionLabel = isActive
    ? "제휴 상세 보기"
    : "현재 이용할 수 없는 제휴";

  return (
    <div
      data-partner-card-actions
      className={cn(
        compact
          ? "hidden h-full items-center justify-end gap-2 min-[480px]:flex"
          : "mt-auto space-y-3 pt-1",
      )}
    >
      {!isActive && !compact ? (
        <p className="text-ko-pretty text-sm text-amber-800 dark:text-amber-200">
          현재 이용할 수 없는 제휴입니다.
        </p>
      ) : null}
      {compact ? (
        <Button
          variant={isActive ? "primary" : "secondary"}
          size="icon"
          href={detailHref}
          className="self-end rounded-full"
          onClick={onDetailClick}
          disabled={!canNavigate}
          ariaLabel={detailActionLabel}
          title={detailActionLabel}
        >
          <ArrowRightIcon className="size-4" aria-hidden="true" />
        </Button>
      ) : (
        <Button
          variant={isActive ? "primary" : "secondary"}
          href={detailHref}
          className="w-full justify-center"
          onClick={onDetailClick}
          disabled={!canNavigate}
        >
          제휴 상세 보기
        </Button>
      )}
    </div>
  );
}
