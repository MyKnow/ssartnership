import ContactCopyRow from "@/components/ContactCopyRow";
import Button from "@/components/ui/Button";
import PageSection from "@/components/ui/PageSection";
import Surface from "@/components/ui/Surface";
import PartnerDetailBenefitActionLink from "./PartnerDetailBenefitActionLink";

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
}) {
  if (!isActive) {
    return (
      <Surface level="inset" padding="lg" className="w-full">
        <PageSection title="혜택 이용과 문의">
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-900 dark:text-amber-200">
          현재 제휴기간이 아니므로, 혜택 이용/문의를 할 수 없습니다.
        </div>
        </PageSection>
      </Surface>
    );
  }

  return (
    <div className={`grid gap-4 ${contactCount > 1 ? "xl:grid-cols-2" : ""}`}>
      {benefitUseAction ? (
        <Surface level="inset" padding="lg" className="w-full">
          <PageSection title="혜택 이용">
          {benefitUseAction.disabled ? (
            <Button
              className="mt-4 w-full justify-center"
              disabled
              variant="secondary"
            >
              {benefitUseAction.label}
            </Button>
          ) : benefitUseAction.type === "certification" ? (
            <Button
              className="mt-4 w-full justify-center"
              href={benefitUseAction.href}
              variant="primary"
            >
              {benefitUseAction.label}
            </Button>
          ) : benefitUseAction.type === "external_link" ? (
            <PartnerDetailBenefitActionLink
              href={benefitUseAction.href}
              partnerId={partnerId}
            />
          ) : (
            <ContactCopyRow
              href={benefitUseAction.href}
              label={benefitUseAction.label}
              rawValue={normalizedLinks.benefitActionLink || normalizedLinks.reservationLink || benefitUseAction.href}
              eventName="reservation_click"
              targetType="partner"
              targetId={partnerId}
            />
          )}
          </PageSection>
        </Surface>
      ) : null}

      {inquiryDisplay ? (
        <Surface level="inset" padding="lg" className="w-full">
          <PageSection title="문의">
          <ContactCopyRow
            href={inquiryDisplay.href}
            label={inquiryDisplay.label}
            rawValue={normalizedLinks.inquiryLink ?? ""}
            eventName="inquiry_click"
            targetType="partner"
            targetId={partnerId}
          />
          </PageSection>
        </Surface>
      ) : null}

      {contactCount === 0 ? (
        <Surface level="inset" padding="lg" className="w-full">
          <PageSection title="혜택 이용과 문의">
          <div className="rounded-2xl border border-border bg-surface-muted px-4 py-3 text-sm text-muted-foreground">
            현재 등록된 혜택 이용/문의 정보가 없습니다.
          </div>
          </PageSection>
        </Surface>
      ) : null}
    </div>
  );
}
