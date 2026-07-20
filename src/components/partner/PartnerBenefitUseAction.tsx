"use client";

import { createPortal } from "react-dom";
import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { trackProductEvent } from "@/lib/product-events";

export type OfflinePartnerBenefitAction = {
  partnerId: string;
  partnerName: string;
  benefits: string[];
  returnTo: string;
};

export default function PartnerBenefitUseAction({
  action,
  className,
}: {
  action: OfflinePartnerBenefitAction;
  className?: string;
}) {
  const router = useRouter();
  const dialogId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedBenefit, setSelectedBenefit] = useState("");
  const portalRoot = typeof document === "undefined" ? null : document.body;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  function openDialog() {
    setSelectedBenefit("");
    setIsOpen(true);
    trackProductEvent({
      eventName: "partner_benefit_use_open",
      targetType: "partner",
      targetId: action.partnerId,
      properties: { source: "partner_detail" },
    });
  }

  function handleBenefitChange(value: string) {
    setSelectedBenefit(value);
    const benefitIndex = action.benefits.findIndex((benefit) => benefit === value);
    trackProductEvent({
      eventName: "partner_benefit_use_select",
      targetType: "partner",
      targetId: action.partnerId,
      properties: {
        source: "partner_detail_benefit_dialog",
        ...(benefitIndex >= 0 ? { benefitIndex } : {}),
      },
    });
  }

  function confirmSelection() {
    if (!selectedBenefit) {
      return;
    }
    const benefitIndex = action.benefits.findIndex((benefit) => benefit === selectedBenefit);
    trackProductEvent({
      eventName: "partner_benefit_use_confirm",
      targetType: "partner",
      targetId: action.partnerId,
      properties: {
        source: "partner_detail_benefit_dialog",
        ...(benefitIndex >= 0 ? { benefitIndex } : {}),
      },
    });
    const params = new URLSearchParams({
      benefit: selectedBenefit,
      returnTo: action.returnTo,
    });
    setIsOpen(false);
    router.push(`/partners/${encodeURIComponent(action.partnerId)}/benefit-use?${params}`);
  }

  return (
    <>
      <Button
        type="button"
        variant="primary"
        className={className ?? "!h-14 w-full justify-center rounded-[1rem] text-base"}
        onClick={openDialog}
      >
        혜택 이용하기
      </Button>

      {isOpen && portalRoot
        ? createPortal(
            <div
              data-partner-benefit-use-dialog-root
              className="fixed inset-0 z-50 flex min-h-full items-end justify-center overflow-y-auto bg-foreground/35 p-3 sm:items-center sm:p-6"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  setIsOpen(false);
                }
              }}
            >
              <section
                role="dialog"
                aria-modal="true"
                aria-labelledby={`${dialogId}-title`}
                className="w-full max-w-lg rounded-[1.5rem] border border-border bg-surface p-5 shadow-overlay sm:p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                      {action.partnerName}
                    </p>
                    <h2
                      id={`${dialogId}-title`}
                      className="mt-2 text-xl font-bold text-foreground"
                    >
                      혜택 이용하기
                    </h2>
                  </div>
                  <button
                    type="button"
                    className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-xl text-muted-foreground hover:bg-surface-muted"
                    aria-label="혜택 이용하기 닫기"
                    onClick={() => setIsOpen(false)}
                  >
                    ×
                  </button>
                </div>

                <label className="mt-6 grid gap-2 text-sm font-semibold text-foreground">
                  이용할 혜택
                  <select
                    value={selectedBenefit}
                    onChange={(event) => handleBenefitChange(event.target.value)}
                    className="h-12 w-full min-w-0 rounded-2xl border border-border bg-surface-control px-3 text-base font-medium text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">혜택을 선택해 주세요</option>
                    {action.benefits.map((benefit, index) => (
                      <option key={`${benefit}-${index}`} value={benefit}>
                        {benefit}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="mt-6 grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="justify-center"
                    onClick={() => setIsOpen(false)}
                  >
                    취소
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    className="justify-center"
                    disabled={!selectedBenefit}
                    onClick={confirmSelection}
                  >
                    확인
                  </Button>
                </div>
              </section>
            </div>,
            portalRoot,
          )
        : null}
    </>
  );
}
