"use client";

import Button from "@/components/ui/Button";
import { trackProductEvent } from "@/lib/product-events";
import type { PartnerDetailBenefitUseAction } from "@/lib/partner-detail-benefit-action";
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
  certificationBenefitAction,
  inquiryAction,
}: {
  partnerId: string;
  benefitUseAction: PartnerDetailBenefitUseAction | null;
  certificationBenefitAction?: OfflinePartnerBenefitAction | null;
  inquiryAction: MobileInquiryAction | null;
}) {
  const hasBenefitAction = Boolean(certificationBenefitAction || benefitUseAction);
  if (!hasBenefitAction && !inquiryAction) {
    return null;
  }

  const renderBenefitAction = (
    source: BenefitActionSource,
    className: string,
  ) => {
    if (certificationBenefitAction) {
      return (
        <PartnerBenefitUseAction
          action={certificationBenefitAction}
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
        {benefitUseAction.requiresLogin
          ? benefitUseAction.label
          : benefitUseAction.type === "external_link"
          ? "혜택 이용하기"
          : benefitUseAction.label}
      </Button>
    );
  };

  return (
    <>
      <div
        data-partner-detail-mobile-action-bar
        className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-safe-bottom-2 md:hidden"
      >
        <div className="site-mobile-nav-glass pointer-events-auto mx-auto w-full max-w-md rounded-[1.75rem] p-2">
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
              "h-12 w-full min-w-0 justify-center rounded-[1rem] px-3",
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
                className={
                  hasBenefitAction
                    ? "h-12 w-full min-w-0 justify-center rounded-[1.2rem] border-[var(--navigation-glass-border)] bg-surface-overlay/75 px-3 shadow-none backdrop-blur-md hover:bg-surface-overlay"
                    : "h-12 w-full min-w-0 justify-center rounded-[1.2rem] px-3"
                }
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
        </div>
      </div>

      {hasBenefitAction ? (
        <div
          data-partner-detail-desktop-action-fab
          className="pointer-events-none fixed bottom-safe-bottom-6 right-6 z-30 hidden md:flex"
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
