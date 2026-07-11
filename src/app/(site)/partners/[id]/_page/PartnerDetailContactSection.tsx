import ContactCopyRow from "@/components/ContactCopyRow";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import PartnerDetailBenefitActionLink from "./PartnerDetailBenefitActionLink";
import PartnerDetailInfoRow from "./PartnerDetailInfoRow";

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.73a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.92Z" />
    </svg>
  );
}

type ContactDisplay = NonNullable<
  ReturnType<typeof import("@/lib/partner-links").getContactDisplay>
>;
type BenefitUseAction = NonNullable<
  ReturnType<typeof import("@/lib/partner-links").getBenefitUseAction>
>;

export default function PartnerDetailContactSection({
  isActive,
  contactCount,
  benefitUseAction,
  inquiryDisplay,
  normalizedLinks,
  partnerId,
  className,
  mode = "details",
}: {
  isActive: boolean;
  contactCount: number;
  benefitUseAction: BenefitUseAction | null;
  inquiryDisplay: ContactDisplay | null;
  normalizedLinks: {
    benefitActionLink: string;
    reservationLink: string;
    inquiryLink: string;
  };
  partnerId: string;
  className?: string;
  mode?: "details" | "primary";
}) {
  if (!isActive) {
    if (mode === "primary") {
      return null;
    }
    return (
      <section className={cn("min-w-0", className)}>
        <div className="rounded-[1rem] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-900 dark:text-amber-200">
          현재 제휴기간이 아니므로, 혜택 이용/문의를 할 수 없습니다.
        </div>
      </section>
    );
  }

  if (mode === "primary") {
    if (!benefitUseAction) {
      return null;
    }
    return (
      <section
        className={cn("min-w-0", className)}
        aria-label="혜택 이용"
      >
        <div data-primary-benefit-action className="w-full">
          {benefitUseAction.disabled ? (
            <Button
              className="!h-14 w-full justify-center rounded-[1rem] text-base"
              disabled
              variant="secondary"
            >
              {benefitUseAction.label}
            </Button>
          ) : benefitUseAction.type === "certification" ? (
            <Button
              className="!h-14 w-full justify-center rounded-[1rem] text-base"
              href={benefitUseAction.href}
              variant="primary"
            >
              {benefitUseAction.label}
            </Button>
          ) : benefitUseAction.type === "external_link" ? (
            <PartnerDetailBenefitActionLink
              href={benefitUseAction.href}
              partnerId={partnerId}
              compact
            />
          ) : (
            <ContactCopyRow
              href={benefitUseAction.href}
              label={benefitUseAction.label}
              rawValue={
                normalizedLinks.benefitActionLink ||
                normalizedLinks.reservationLink ||
                benefitUseAction.href
              }
              eventName="reservation_click"
              targetType="partner"
              targetId={partnerId}
              compact
            />
          )}
        </div>
      </section>
    );
  }

  if (inquiryDisplay) {
    return (
      <PartnerDetailInfoRow
        label="연락처"
        labelId={`partner-inquiry-${partnerId}`}
        icon={<PhoneIcon className="size-4 shrink-0" />}
        dataInquirySection
        className={className}
      >
        <ContactCopyRow
          href={inquiryDisplay.href}
          label={inquiryDisplay.label}
          rawValue={normalizedLinks.inquiryLink ?? ""}
          eventName="inquiry_click"
          targetType="partner"
          targetId={partnerId}
          compact
          className="!min-h-11 !border-0 !bg-transparent !p-0"
          contentClassName="!px-0"
        />
      </PartnerDetailInfoRow>
    );
  }

  if (contactCount === 0) {
    return (
      <div
        className={cn(
          "rounded-[1rem] border border-border bg-surface-muted px-4 py-3 text-sm text-muted-foreground",
          className,
        )}
      >
        현재 등록된 혜택 이용/문의 정보가 없습니다.
      </div>
    );
  }

  return null;
}
