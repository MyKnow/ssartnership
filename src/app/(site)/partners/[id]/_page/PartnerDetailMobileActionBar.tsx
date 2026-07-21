"use client";

import Button from "@/components/ui/Button";
import Container from "@/components/ui/Container";
import { trackProductEvent } from "@/lib/product-events";
import type { BenefitUseAction } from "@/lib/partner-links";
import PartnerBenefitUseAction, {
  type OfflinePartnerBenefitAction,
} from "@/components/partner/PartnerBenefitUseAction";

type MobileInquiryAction = {
  href: string;
  label: string;
};

type BenefitActionSource = "detail_mobile_sticky" | "detail_desktop_fab";

export default function PartnerDetailMobileActionBar({
  partnerId,
  benefitUseAction,
  offlineBenefitAction,
  inquiryAction,
}: {
  partnerId: string;
  benefitUseAction: BenefitUseAction | null;
  offlineBenefitAction?: OfflinePartnerBenefitAction | null;
  inquiryAction: MobileInquiryAction | null;
}) {
  const hasBenefitAction = Boolean(offlineBenefitAction || benefitUseAction);
  if (!hasBenefitAction && !inquiryAction) {
    return null;
  }

  const renderBenefitAction = (
    source: BenefitActionSource,
    className: string,
  ) => {
    if (offlineBenefitAction) {
      return (
        <PartnerBenefitUseAction
          action={offlineBenefitAction}
          className={className}
        />
      );
    }

    if (!benefitUseAction) {
      return null;
    }

    return (
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
        variant="primary"
        className={className}
        onClick={() =>
          trackProductEvent({
            eventName: "reservation_click",
            targetType: "partner",
            targetId: partnerId,
            properties: { source },
          })
        }
      >
        {benefitUseAction.label}
      </Button>
    );
  };

  return (
    <>
      <div
        data-partner-detail-mobile-action-bar
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border/80 bg-surface-overlay/95 pb-safe-bottom-2 shadow-overlay backdrop-blur-xl md:hidden"
      >
        <Container className="py-2">
          <div
            data-partner-detail-mobile-action-buttons
            className={
              hasBenefitAction && inquiryAction
                ? "grid grid-cols-2 gap-2"
                : "grid grid-cols-1"
            }
          >
            {renderBenefitAction(
              "detail_mobile_sticky",
              "h-14 w-full min-w-0 justify-center rounded-[1rem] px-3",
            )}
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
                  hasBenefitAction ? "secondary" : "primary"
                }
                className="h-14 w-full min-w-0 justify-center rounded-[1rem] px-3"
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

      {hasBenefitAction ? (
        <div
          data-partner-detail-desktop-action-fab
          className="pointer-events-none fixed bottom-safe-bottom-6 right-[max(1.5rem,calc((100vw-72rem)/4+1.5rem))] z-30 hidden md:flex"
        >
          <div className="pointer-events-auto">
            {renderBenefitAction(
              "detail_desktop_fab",
              "!h-14 !w-auto min-w-0 justify-center rounded-full px-5 text-sm shadow-overlay",
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
