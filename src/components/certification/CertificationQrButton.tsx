"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import { cn } from "@/lib/cn";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { CERTIFICATION_QR_TTL_SECONDS } from "@/lib/certification-constants";
import { trackProductEvent } from "@/lib/product-events";

type CertificationQrResponse = {
  verifyUrl: string;
  expiresAt: string;
};

const COUNTDOWN_TICK_MS = 250;

export default function CertificationQrButton({
  roleLabel = "교육생",
  className,
}: {
  roleLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [verifyUrl, setVerifyUrl] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const expiresAtMs = expiresAt ? new Date(expiresAt).getTime() : 0;
  const remainingSeconds = expiresAtMs
    ? Math.max(0, Math.ceil((expiresAtMs - now) / 1000))
    : CERTIFICATION_QR_TTL_SECONDS;

  useEffect(() => {
    if (!open) {
      return;
    }
    const originalOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const timer = window.setInterval(() => setNow(Date.now()), COUNTDOWN_TICK_MS);
    return () => window.clearInterval(timer);
  }, [open]);

  useEffect(() => {
    if (!verifyUrl) {
      setQrDataUrl("");
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(verifyUrl, {
      width: 256,
      margin: 1,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    })
      .then((dataUrl) => {
        if (!cancelled) {
          setQrDataUrl(dataUrl);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("QR 생성에 실패했습니다.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [verifyUrl]);

  const requestQr = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/mm/certification-token", {
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({}))) as Partial<CertificationQrResponse> & {
        error?: string;
      };
      if (!response.ok || !data.verifyUrl || !data.expiresAt) {
        setError("QR을 불러오지 못했습니다. 다시 시도해 주세요.");
        return;
      }
      setVerifyUrl(data.verifyUrl);
      setExpiresAt(data.expiresAt);
      setNow(Date.now());
    } catch {
      setError("QR을 불러오지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    void requestQr();
  }, [open, requestQr]);

  useEffect(() => {
    if (!open || !expiresAtMs) {
      return;
    }
    const delay = Math.max(0, expiresAtMs - Date.now());
    const refreshTimer = window.setTimeout(() => {
      void requestQr();
    }, delay);
    return () => window.clearTimeout(refreshTimer);
  }, [open, expiresAtMs, requestQr]);

  const expiryLabel = useMemo(() => {
    if (remainingSeconds <= 1) {
      return "곧 갱신";
    }
    return `${remainingSeconds}초 후 갱신`;
  }, [remainingSeconds]);

  return (
    <>
      <Button
        variant="ghost"
        className={cn(
          "!border-white/15 !bg-white/10 !text-white shadow-[0_10px_24px_rgba(15,23,42,0.14)] backdrop-blur-md hover:!border-white/25 hover:!bg-white/15",
          className,
        )}
        onClick={() => {
          trackProductEvent({
            eventName: "certification_qr_open",
            targetType: "certification_qr",
          });
          setOpen(true);
        }}
      >
        QR 표시
      </Button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-50 bg-slate-950/72 backdrop-blur-sm">
              <button
                type="button"
                className="absolute inset-0"
                aria-label="QR 닫기"
                onClick={() => setOpen(false)}
              />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4 sm:p-6">
                <section
                  role="dialog"
                  aria-modal="true"
                  className="pointer-events-auto relative w-full max-w-[22rem] overflow-hidden rounded-[32px] border border-white/15 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(15,23,42,0.9))] px-4 pb-safe-bottom-4 pt-3 text-white shadow-[0_24px_80px_rgba(15,23,42,0.45)] max-h-[86dvh] overflow-y-auto sm:max-w-[28rem] sm:px-5 sm:pb-5 sm:pt-5"
                >
                  <div className="pointer-events-none absolute inset-0">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.12),transparent_35%),radial-gradient(circle_at_80%_20%,rgba(196,181,253,0.08),transparent_30%)]" />
                    <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.08)_0%,transparent_30%,transparent_72%,rgba(255,255,255,0.04)_100%)]" />
                  </div>

                  <div className="relative flex items-center justify-between gap-3">
                    <div className="flex-1" />
                    <button
                      type="button"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/15"
                      onClick={() => setOpen(false)}
                      aria-label="닫기"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="relative flex flex-col items-center gap-3 text-center">
                    <div className="mt-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/55">
                        Live QR
                      </p>
                      <h2 className="mt-2 text-xl font-semibold">{roleLabel} QR</h2>
                      <p className="mt-2 text-sm leading-6 text-white/68">
                        누구나 스캔해 현재 인증 상태를 검증할 수 있습니다.
                      </p>
                    </div>

                    <div className="flex aspect-square w-full max-w-[16rem] items-center justify-center rounded-[26px] border border-white/10 bg-white p-2.5 shadow-[0_12px_30px_rgba(15,23,42,0.18)] sm:max-w-[17rem] sm:p-3">
                      {loading ? (
                        <Spinner className="h-8 w-8 text-slate-700" />
                      ) : error ? (
                        <div className="grid gap-3 text-sm text-slate-700">
                          <p>{error}</p>
                          <Button variant="ghost" onClick={() => void requestQr()}>
                            다시 시도
                          </Button>
                        </div>
                      ) : qrDataUrl ? (
                        <div className="relative h-full w-full">
                          <Image
                            src={qrDataUrl}
                            alt={`${roleLabel} 검증 QR`}
                            fill
                            unoptimized
                            sizes="(max-width: 640px) calc(100vw - 96px), 256px"
                            className="rounded-2xl object-contain"
                          />
                        </div>
                      ) : (
                        <Spinner className="h-8 w-8 text-slate-700" />
                      )}
                    </div>

                    <div className="grid gap-2 text-white/80">
                      <p className="text-sm font-medium">{expiryLabel}</p>
                      <p className="text-xs text-white/55">
                        QR은 짧은 만료시간을 가지며 자동으로 새로 발급됩니다.<br />검증자는
                        QR을 스캔해 현재 인증 상태를 확인할 수 있습니다.
                      </p>
                    </div>
                  </div>
                </section>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
