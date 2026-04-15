import Button from "@/components/ui/Button";

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
    return (
      <div className="mt-5 flex flex-col gap-2">
        {reservationAction ? (
          <Button
            variant="ghost"
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
            variant="ghost"
            href={inquiryAction.href}
            target={inquiryAction.href.startsWith("http") ? "_blank" : undefined}
            rel={inquiryAction.href.startsWith("http") ? "noreferrer" : undefined}
            className="w-full justify-center"
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
        현재 제휴기간이 아니므로, 예약/문의를 할 수 없습니다.
      </div>
    );
  }

  return null;
}

