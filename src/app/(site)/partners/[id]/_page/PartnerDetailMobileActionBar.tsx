"use client";

import Button from "@/components/ui/Button";
import Container from "@/components/ui/Container";
import { trackProductEvent } from "@/lib/product-events";
import type { BenefitUseAction } from "@/lib/partner-links";

type MobileInquiryAction = {
  href: string;
  label: string;
};

export default function PartnerDetailMobileActionBar({
  partnerId,
  benefitUseAction,
  inquiryAction,
}: {
  partnerId: string;
  benefitUseAction: BenefitUseAction | null;
  inquiryAction: MobileInquiryAction | null;
}) {
  if (!benefitUseAction && !inquiryAction) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/80 bg-surface-overlay/95 pb-safe-bottom-4 shadow-overlay backdrop-blur-xl md:hidden">
      <Container className="py-3">
        <div
          className={
            benefitUseAction && inquiryAction
              ? "grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-2"
              : "grid"
          }
        >
          {benefitUseAction ? (
            <Button
              href={benefitUseAction.href}
              target={
                /^https?:\/\//.test(benefitUseAction.href) ? "_blank" : undefined
              }
              rel={
                /^https?:\/\//.test(benefitUseAction.href)
                  ? "noopener noreferrer"
                  : undefined
              }
              disabled={Boolean(benefitUseAction.disabled)}
              variant={benefitUseAction.disabled ? "secondary" : "primary"}
              className="min-w-0 justify-center px-3"
              onClick={() =>
                trackProductEvent({
                  eventName: "reservation_click",
                  targetType: "partner",
                  targetId: partnerId,
                  properties: { source: "detail_mobile_sticky" },
                })
              }
            >
              {benefitUseAction.label}
            </Button>
          ) : null}
          {inquiryAction ? (
            <Button
              href={inquiryAction.href}
              target={
                /^https?:\/\//.test(inquiryAction.href) ? "_blank" : undefined
              }
              rel={
                /^https?:\/\//.test(inquiryAction.href)
                  ? "noopener noreferrer"
                  : undefined
              }
              variant={
                benefitUseAction && !benefitUseAction.disabled
                  ? "secondary"
                  : "primary"
              }
              className="min-w-0 justify-center px-3"
              ariaLabel={`문의하기: ${inquiryAction.label}`}
              onClick={() =>
                trackProductEvent({
                  eventName: "inquiry_click",
                  targetType: "partner",
                  targetId: partnerId,
                  properties: { source: "detail_mobile_sticky" },
                })
              }
            >
              문의하기
            </Button>
          ) : null}
        </div>
      </Container>
    </div>
  );
}
