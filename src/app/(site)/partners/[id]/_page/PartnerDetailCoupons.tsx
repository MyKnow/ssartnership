"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircleIcon, ClipboardIcon, TicketIcon } from "@heroicons/react/24/outline";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import SectionHeading from "@/components/ui/SectionHeading";
import { useToast } from "@/components/ui/Toast";
import { getProductSessionId, trackProductEvent } from "@/lib/product-events";
import type { AdCoupon } from "@/lib/repositories/ad-package-repository";

type CouponMessage = {
  tone: "success" | "error";
  text: string;
};

type RedeemResponse = {
  ok?: boolean;
  message?: string;
  coupon?: AdCoupon;
};

function getUsageLabel(coupon: AdCoupon, usedCount: number) {
  if (typeof coupon.usageLimit !== "number") {
    return `${usedCount.toLocaleString("ko-KR")}회 사용`;
  }
  return `${usedCount.toLocaleString("ko-KR")} / ${coupon.usageLimit.toLocaleString("ko-KR")}회 사용`;
}

function getLoginHref(returnTo: string) {
  return `/auth/login?returnTo=${encodeURIComponent(returnTo)}`;
}

export default function PartnerDetailCoupons({
  coupons,
  partnerId,
  currentUserId,
  returnTo,
}: {
  coupons: AdCoupon[];
  partnerId: string;
  currentUserId: string | null;
  returnTo: string;
}) {
  const { notify } = useToast();
  const viewedCouponIds = useRef(new Set<string>());
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, CouponMessage>>({});
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(coupons.map((coupon) => [coupon.id, coupon.usedCount])),
  );
  const loginHref = useMemo(() => getLoginHref(returnTo), [returnTo]);

  useEffect(() => {
    for (const coupon of coupons) {
      if (viewedCouponIds.current.has(coupon.id)) {
        continue;
      }
      viewedCouponIds.current.add(coupon.id);
      trackProductEvent({
        eventName: "coupon_view",
        targetType: "ad_coupon",
        targetId: coupon.id,
        properties: {
          campaignId: coupon.campaignId,
          partnerId,
        },
      });
    }
  }, [coupons, partnerId]);

  if (coupons.length === 0) {
    return null;
  }

  async function copyCouponCode(coupon: AdCoupon) {
    if (!coupon.code) {
      return;
    }
    try {
      await navigator.clipboard.writeText(coupon.code);
      trackProductEvent({
        eventName: "coupon_copy",
        targetType: "ad_coupon",
        targetId: coupon.id,
        properties: {
          campaignId: coupon.campaignId,
          partnerId,
        },
      });
      notify("쿠폰 코드가 복사되었습니다.");
      setMessages((current) => ({
        ...current,
        [coupon.id]: {
          tone: "success",
          text: "쿠폰 코드를 복사했습니다.",
        },
      }));
    } catch {
      notify("쿠폰 코드 복사에 실패했습니다.");
      setMessages((current) => ({
        ...current,
        [coupon.id]: {
          tone: "error",
          text: "브라우저에서 복사를 허용하지 않았습니다.",
        },
      }));
    }
  }

  async function redeemCoupon(coupon: AdCoupon) {
    setRedeemingId(coupon.id);
    setMessages((current) => ({
      ...current,
      [coupon.id]: {
        tone: "success",
        text: "쿠폰 사용을 확인하고 있습니다.",
      },
    }));

    try {
      const response = await fetch(`/api/coupons/${encodeURIComponent(coupon.id)}/redeem`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          sessionId: getProductSessionId(),
        }),
      });
      const payload = (await response.json().catch(() => null)) as RedeemResponse | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || "쿠폰 사용 확인에 실패했습니다.");
      }

      const nextUsedCount =
        typeof payload.coupon?.usedCount === "number"
          ? payload.coupon.usedCount
          : (usageCounts[coupon.id] ?? coupon.usedCount) + 1;
      setUsageCounts((current) => ({
        ...current,
        [coupon.id]: nextUsedCount,
      }));
      setMessages((current) => ({
        ...current,
        [coupon.id]: {
          tone: "success",
          text: "쿠폰 사용 확인이 기록되었습니다.",
        },
      }));
      notify("쿠폰 사용 확인이 기록되었습니다.");
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "쿠폰 사용 확인에 실패했습니다.";
      setMessages((current) => ({
        ...current,
        [coupon.id]: {
          tone: "error",
          text: message,
        },
      }));
      notify(message);
    } finally {
      setRedeemingId(null);
    }
  }

  return (
    <Card className="w-full p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading
          title="SSAFY 쿠폰"
          description="제휴처가 제공하는 한정 혜택입니다."
        />
        <Badge variant="primary">{coupons.length.toLocaleString("ko-KR")}개 제공</Badge>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {coupons.map((coupon) => {
          const usedCount = usageCounts[coupon.id] ?? coupon.usedCount;
          const message = messages[coupon.id];
          const canCopy = Boolean(coupon.code);
          const isRedeeming = redeemingId === coupon.id;
          return (
            <article
              key={coupon.id}
              className="grid gap-4 rounded-[1.25rem] border border-border bg-surface-muted p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="success" className="tracking-normal">
                      {coupon.discountLabel || "쿠폰"}
                    </Badge>
                    <span className="text-xs font-medium text-muted-foreground">
                      {getUsageLabel(coupon, usedCount)}
                    </span>
                  </div>
                  <h2 className="mt-3 text-lg font-semibold text-foreground">{coupon.title}</h2>
                  {coupon.description ? (
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {coupon.description}
                    </p>
                  ) : null}
                </div>
                <TicketIcon className="size-6 shrink-0 text-primary" aria-hidden="true" />
              </div>

              {coupon.code ? (
                <div className="rounded-2xl border border-dashed border-border bg-surface px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Coupon Code
                  </p>
                  <p className="mt-1 break-all font-mono text-sm font-semibold text-foreground">
                    {coupon.code}
                  </p>
                </div>
              ) : null}

              {coupon.terms.length > 0 ? (
                <ul className="grid gap-1 text-xs leading-5 text-muted-foreground">
                  {coupon.terms.map((term) => (
                    <li key={term}>- {term}</li>
                  ))}
                </ul>
              ) : null}

              {message ? (
                <p
                  className={
                    message.tone === "error"
                      ? "text-xs font-medium text-danger"
                      : "text-xs font-medium text-success"
                  }
                >
                  {message.text}
                </p>
              ) : null}

              <div className="flex flex-col gap-2 sm:flex-row">
                {canCopy ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full justify-center sm:flex-1"
                    onClick={() => {
                      void copyCouponCode(coupon);
                    }}
                  >
                    <ClipboardIcon className="size-4" />
                    코드 복사
                  </Button>
                ) : null}
                {coupon.externalUrl ? (
                  <Button
                    href={coupon.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="secondary"
                    className="w-full justify-center sm:flex-1"
                  >
                    쿠폰 열기
                  </Button>
                ) : null}
                {currentUserId ? (
                  <Button
                    type="button"
                    variant="primary"
                    className="w-full justify-center sm:flex-1"
                    loading={isRedeeming}
                    loadingText="확인 중"
                    onClick={() => {
                      void redeemCoupon(coupon);
                    }}
                  >
                    <CheckCircleIcon className="size-4" />
                    사용 확인
                  </Button>
                ) : (
                  <Button
                    href={loginHref}
                    variant="primary"
                    className="w-full justify-center sm:flex-1"
                  >
                    로그인 후 사용
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </Card>
  );
}
