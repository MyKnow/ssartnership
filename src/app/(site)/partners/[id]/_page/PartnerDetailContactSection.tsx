import ContactCopyRow from "@/components/ContactCopyRow";
import Card from "@/components/ui/Card";
import SectionHeading from "@/components/ui/SectionHeading";

type ContactDisplay = NonNullable<
  ReturnType<typeof import("@/lib/partner-links").getContactDisplay>
>;

export default function PartnerDetailContactSection({
  isActive,
  contactCount,
  reservationDisplay,
  inquiryDisplay,
  normalizedLinks,
  partnerId,
}: {
  isActive: boolean;
  contactCount: number;
  reservationDisplay: ContactDisplay | null;
  inquiryDisplay: ContactDisplay | null;
  normalizedLinks: {
    reservationLink: string;
    inquiryLink: string;
  };
  partnerId: string;
}) {
  if (!isActive) {
    return (
      <Card className="w-full p-4 sm:p-5">
        <SectionHeading title="예약/문의" />
        <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-900 dark:text-amber-200">
          현재 제휴기간이 아니므로, 예약/문의를 할 수 없습니다.
        </div>
      </Card>
    );
  }

  return (
    <div className={`grid gap-4 ${contactCount > 1 ? "xl:grid-cols-2" : ""}`}>
      {reservationDisplay ? (
        <Card className="w-full p-4 sm:p-5">
          <SectionHeading title="예약" />
          <ContactCopyRow
            href={reservationDisplay.href}
            label={reservationDisplay.label}
            rawValue={normalizedLinks.reservationLink ?? ""}
            eventName="reservation_click"
            targetType="partner"
            targetId={partnerId}
          />
        </Card>
      ) : null}

      {inquiryDisplay ? (
        <Card className="w-full p-4 sm:p-5">
          <SectionHeading title="문의" />
          <ContactCopyRow
            href={inquiryDisplay.href}
            label={inquiryDisplay.label}
            rawValue={normalizedLinks.inquiryLink ?? ""}
            eventName="inquiry_click"
            targetType="partner"
            targetId={partnerId}
          />
        </Card>
      ) : null}

      {contactCount === 0 ? (
        <Card className="w-full p-4 sm:p-5">
          <SectionHeading title="예약/문의" />
          <div className="mt-4 rounded-2xl border border-border bg-surface-muted px-4 py-3 text-sm text-muted-foreground">
            현재 등록된 예약/문의 정보가 없습니다.
          </div>
        </Card>
      ) : null}
    </div>
  );
}
