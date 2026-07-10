import Button from "@/components/ui/Button";

export default function PartnerCardActions({
  isActive,
  detailHref,
  canNavigate,
  onDetailClick,
}: {
  isActive: boolean;
  detailHref: string;
  canNavigate: boolean;
  onDetailClick: () => void;
}) {
  return (
    <div className="mt-auto space-y-3 pt-1">
      {!isActive ? (
        <p className="text-ko-pretty text-sm text-amber-800 dark:text-amber-200">
          현재 이용할 수 없는 제휴입니다.
        </p>
      ) : null}
      <Button
        variant={isActive ? "primary" : "secondary"}
        href={detailHref}
        className="w-full justify-center"
        onClick={onDetailClick}
        disabled={!canNavigate}
      >
        제휴 상세 보기
      </Button>
    </div>
  );
}
