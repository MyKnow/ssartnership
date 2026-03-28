"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { CERTIFICATION_QR_TTL_SECONDS } from "@/lib/certification-constants";

type CertificationQrResponse = {
  verifyUrl: string;
  expiresAt: string;
};

const COUNTDOWN_TICK_MS = 250;

export default function CertificationQrButton() {
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
      width: 320,
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
      <Button variant="ghost" onClick={() => setOpen(true)}>
        QR 표시
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-6">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="QR 닫기"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 w-full max-w-sm rounded-[32px] border border-white/15 bg-white p-6 text-slate-900 shadow-2xl">
            <button
              type="button"
              className="absolute right-4 top-4 inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900"
              onClick={() => setOpen(false)}
              aria-label="닫기"
            >
              ✕
            </button>

            <div className="flex flex-col items-center gap-4 text-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  SSARTNERSHIP
                </p>
                <h2 className="mt-2 text-2xl font-semibold">교육생 QR 검증</h2>
                <p className="mt-2 text-sm text-slate-600">
                  누구나 스캔해 현재 교육생 인증 상태를 검증할 수 있습니다.
                </p>
              </div>

              <div className="flex h-[320px] w-[320px] items-center justify-center rounded-3xl border border-slate-200 bg-slate-50 p-4">
                {loading ? (
                  <Spinner className="h-8 w-8 text-slate-700" />
                ) : error ? (
                  <div className="grid gap-3 text-sm text-slate-600">
                    <p>{error}</p>
                    <Button variant="ghost" onClick={() => void requestQr()}>
                      다시 시도
                    </Button>
                  </div>
                ) : qrDataUrl ? (
                  <div className="relative h-full w-full">
                    <Image
                      src={qrDataUrl}
                      alt="교육생 검증 QR"
                      fill
                      unoptimized
                      sizes="320px"
                      className="rounded-2xl"
                    />
                  </div>
                ) : (
                  <Spinner className="h-8 w-8 text-slate-700" />
                )}
              </div>

              <div className="grid gap-2">
                <p className="text-sm font-medium text-slate-700">
                  {expiryLabel}
                </p>
                <p className="text-xs text-slate-500">
                  QR은 짧은 만료시간을 가지며 자동으로 새로 발급됩니다. 검증자는
                  QR을 스캔해 현재 인증 상태를 확인할 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
