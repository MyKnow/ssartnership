import Button from "@/components/ui/Button";
import { cn } from "@/lib/cn";

type PartnerAction = {
  href: string;
  label: string;
};

export default function PartnerCardActions({
  isActive,
  reservationAction,
  inquiryAction,
  onReservationClick,
  onInquiryClick,
}: {
  isActive: boolean;
  reservationAction: PartnerAction | null;
  inquiryAction: PartnerAction | null;
  onReservationClick: () => void;
  onInquiryClick: () => void;
}) {
  if (isActive && (reservationAction || inquiryAction)) {
    const hasBothActions = Boolean(reservationAction && inquiryAction);

    return (
      <div
        className={cn(
          "mt-5 gap-2",
          hasBothActions ? "grid grid-cols-2" : "flex flex-col",
        )}
      >
        {reservationAction ? (
          <Button
            variant="primary"
            href={reservationAction.href}
            target={reservationAction.href.startsWith("http") ? "_blank" : undefined}
            rel={reservationAction.href.startsWith("http") ? "noreferrer" : undefined}
            className="w-full justify-center"
            onClick={onReservationClick}
          >
            {reservationAction.label}
          </Button>
        ) : null}
        {inquiryAction ? (
          <Button
            variant="primary"
            href={inquiryAction.href}
            target={inquiryAction.href.startsWith("http") ? "_blank" : undefined}
            rel={inquiryAction.href.startsWith("http") ? "noreferrer" : undefined}
            className={cn(
              "w-full justify-center",
              hasBothActions
                ? "!border-primary/20 !bg-primary-foreground !text-primary shadow-flat hover:!bg-primary-soft hover:!text-primary-emphasis"
                : null,
            )}
            onClick={onInquiryClick}
          >
            {inquiryAction.label}
          </Button>
        ) : null}
      </div>
    );
  }

  if (!isActive) {
    return (
      <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-900 dark:text-amber-200">
        현재 제휴기간이 아니므로, 혜택 이용/문의를 할 수 없습니다.
      </div>
    );
  }

  return null;
}
