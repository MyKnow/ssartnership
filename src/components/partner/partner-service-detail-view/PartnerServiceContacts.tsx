import Card from "@/components/ui/Card";
import SectionHeading from "@/components/ui/SectionHeading";
import ContactCopyRow from "@/components/ContactCopyRow";

export default function PartnerServiceContacts({
  isActive,
  contactCount,
  partnerId,
  reservationDisplay,
  inquiryDisplay,
  reservationRawValue,
  inquiryRawValue,
}: {
  isActive: boolean;
  contactCount: number;
  partnerId: string;
  reservationDisplay: { href: string; label: string } | null;
  inquiryDisplay: { href: string; label: string } | null;
  reservationRawValue: string;
  inquiryRawValue: string;
}) {
  if (!isActive) {
    return (
      <Card className="w-full p-4 sm:p-5">
        <SectionHeading title="혜택 이용/문의" />
        <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-900 dark:text-amber-200">
          현재 브랜드 제휴기간이 아니므로, 혜택 이용/문의를 할 수 없습니다.
        </div>
      </Card>
    );
  }

  return (
    <div className={`grid gap-4 ${contactCount > 1 ? "xl:grid-cols-2" : ""}`}>
      {reservationDisplay ? (
        <Card className="w-full p-4 sm:p-5">
          <SectionHeading title="혜택 이용" />
          <ContactCopyRow
            href={reservationDisplay.href}
            label={reservationDisplay.label}
            rawValue={reservationRawValue}
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
            rawValue={inquiryRawValue}
            eventName="inquiry_click"
            targetType="partner"
            targetId={partnerId}
          />
        </Card>
      ) : null}

      {contactCount === 0 ? (
        <Card className="w-full p-4 sm:p-5">
          <SectionHeading title="혜택 이용/문의" />
          <div className="mt-4 rounded-2xl border border-border bg-surface-muted px-4 py-3 text-sm text-muted-foreground">
            현재 등록된 혜택 이용/문의 정보가 없습니다.
          </div>
        </Card>
      ) : null}
    </div>
  );
}
