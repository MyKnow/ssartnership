"use client";

import { createPortal } from "react-dom";
import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { trackProductEvent } from "@/lib/product-events";
import { PARTNER_BENEFIT_USE_COUNT_STORAGE_MAX } from "@/lib/partner-benefit-usage";

export type OfflinePartnerBenefitAction = {
  partnerId: string;
  partnerName: string;
  benefits: string[];
  maxUseCount?: number | null;
  returnTo: string;
  requiresLogin?: boolean;
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
  const [useCount, setUseCount] = useState(1);
  const maxUseCount = action.maxUseCount ?? null;
  const portalRoot = typeof document === "undefined" ? null : document.body;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function openDialog() {
    if (action.requiresLogin) {
      router.push(`/auth/login?returnTo=${encodeURIComponent(action.returnTo)}`);
      return;
    }
    setSelectedBenefit("");
    setUseCount(1);
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
        useCount,
      },
    });
    const params = new URLSearchParams({
      benefit: selectedBenefit,
      useCount: String(useCount),
      returnTo: action.returnTo,
    });
    setIsOpen(false);
    const benefitUsePath = `/partners/${encodeURIComponent(action.partnerId)}/benefit-use?${params}`;
    router.push(
      action.requiresLogin
        ? `/auth/login?returnTo=${encodeURIComponent(benefitUsePath)}`
        : benefitUsePath,
    );
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
              className="fixed inset-0 z-50 flex min-h-dvh items-end justify-center overflow-y-auto bg-slate-950/60 p-0 backdrop-blur-[2px] dark:bg-black/75 sm:items-center sm:p-6"
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
                data-partner-benefit-use-sheet
                className="max-h-[calc(100dvh-1rem)] w-full overflow-y-auto rounded-t-[2rem] border border-x-0 border-b-0 border-border bg-surface px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 shadow-overlay sm:max-w-lg sm:rounded-[1.5rem] sm:border sm:p-6"
              >
                <div
                  data-partner-benefit-use-sheet-handle
                  className="mx-auto mb-3 h-1 w-10 rounded-full bg-border sm:hidden"
                  aria-hidden="true"
                />
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

                <div className="mt-5 grid gap-2">
                  <div className="flex min-w-0 items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground">이용 횟수</p>
                    <p className="shrink-0 text-sm font-medium text-muted-foreground">제휴 혜택 {useCount}회 적용</p>
                  </div>
                  <div className="grid grid-cols-[3rem_minmax(0,1fr)_3rem] items-center rounded-2xl border border-border bg-surface-control p-1">
                    <button
                      type="button"
                      aria-label="이용 횟수 줄이기"
                      disabled={useCount <= 1}
                      onClick={() => setUseCount((current) => Math.max(1, current - 1))}
                      className="inline-flex size-11 items-center justify-center rounded-xl text-xl font-semibold text-foreground transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      −
                    </button>
                    <output aria-live="polite" className="min-w-0 text-center text-base font-semibold text-foreground">
                      {useCount}회
                    </output>
                    <button
                      type="button"
                      aria-label="이용 횟수 늘리기"
                      disabled={
                        maxUseCount !== null
                          ? useCount >= maxUseCount
                          : useCount >= PARTNER_BENEFIT_USE_COUNT_STORAGE_MAX
                      }
                      onClick={() =>
                        setUseCount((current) =>
                          maxUseCount !== null
                            ? Math.min(maxUseCount, current + 1)
                            : Math.min(
                                PARTNER_BENEFIT_USE_COUNT_STORAGE_MAX,
                                current + 1,
                              ),
                        )
                      }
                      className="inline-flex size-11 items-center justify-center rounded-xl text-xl font-semibold text-foreground transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      +
                    </button>
                  </div>
                </div>

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
