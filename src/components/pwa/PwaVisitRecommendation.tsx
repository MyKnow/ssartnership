"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ArrowDownTrayIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import PwaInstallButton from "@/components/PwaInstallButton";
import Button from "@/components/ui/Button";
import Surface from "@/components/ui/Surface";
import {
  getBrowserPwaInstallPlatform,
  getBrowserStandalonePwa,
} from "@/lib/pwa-install";
import { shouldSuppressPwaVisitRecommendation } from "@/lib/site-navigation";

function canOfferPwaRecommendation(suppressed: boolean) {
  if (suppressed) {
    return false;
  }
  const platform = getBrowserPwaInstallPlatform();
  return platform !== "other" && !getBrowserStandalonePwa();
}

export function PwaVisitRecommendationSurface({
  onDismiss,
}: {
  onDismiss: () => void;
}) {
  return (
    <aside
      data-pwa-visit-recommendation
      aria-labelledby="pwa-visit-recommendation-title"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-3 top-[calc(env(safe-area-inset-top)+5.0625rem)] z-30"
    >
      <Surface
        level="overlay"
        padding="sm"
        className="pointer-events-auto mx-auto max-w-md rounded-[1.375rem] bg-surface-overlay/95"
      >
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-primary-soft text-primary">
            <ArrowDownTrayIcon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p
              id="pwa-visit-recommendation-title"
              className="text-ko-title text-sm font-semibold text-foreground"
            >
              홈 화면에서 더 넓게 이용해 보세요
            </p>
            <p className="text-ko-pretty mt-1 text-xs leading-5 text-muted-foreground">
              설치하면 브라우저 주소창 없이 싸트너십을 앱처럼 열 수 있어요.
            </p>
          </div>
          <button
            type="button"
            aria-label="앱 설치 권장 닫기"
            onClick={onDismiss}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-fade-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
          >
            <XMarkIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <PwaInstallButton
            label="설치 방법 보기"
            variant="primary"
            className="w-full px-3"
          />
          <Button variant="secondary" onClick={onDismiss} className="w-full px-3">
            나중에
          </Button>
        </div>
      </Surface>
    </aside>
  );
}

export default function PwaVisitRecommendation() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const previousPathnameRef = useRef<string | null>(null);
  const suppressed = shouldSuppressPwaVisitRecommendation(pathname);

  useEffect(() => {
    const previousPathname = previousPathnameRef.current;
    previousPathnameRef.current = pathname;

    if (!canOfferPwaRecommendation(suppressed)) {
      const frame = window.requestAnimationFrame(() => setVisible(false));
      return () => window.cancelAnimationFrame(frame);
    }

    if (previousPathname === pathname) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setVisible(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [pathname, suppressed]);

  useEffect(() => {
    const handlePageShow = () => {
      if (!canOfferPwaRecommendation(suppressed)) {
        return;
      }
      window.requestAnimationFrame(() => setVisible(true));
    };

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [pathname, suppressed]);

  useEffect(() => {
    if (!visible || !suppressed) {
      return;
    }

    const frame = window.requestAnimationFrame(() => setVisible(false));
    return () => window.cancelAnimationFrame(frame);
  }, [suppressed, visible]);

  if (!visible || suppressed) {
    return null;
  }

  const dismiss = () => setVisible(false);

  return <PwaVisitRecommendationSurface onDismiss={dismiss} />;
}
