"use client";

import Script from "next/script";
import { useCallback, useRef, useState } from "react";
import type { SsafyVerifyClient } from "@/lib/ssafy-verify/client-errors";

declare global {
  interface Window {
    ssafyVerify?: SsafyVerifyClient;
  }
}

const sdkUrl = "https://verify.myknow.xyz/sdk/ssafy-verify.js";

export default function SsafyVerifyCallbackRelay() {
  const [status, setStatus] = useState<"waiting" | "sent" | "failed">("waiting");
  const didRelayRef = useRef(false);

  const relayCallback = useCallback(() => {
    if (didRelayRef.current) {
      return;
    }

    const sdk = window.ssafyVerify;
    if (!sdk?.handleCallback) {
      return;
    }

    didRelayRef.current = true;

    if (!window.opener) {
      setStatus("failed");
      return;
    }

    sdk.handleCallback({ targetOrigin: window.location.origin });
    setStatus("sent");
    window.setTimeout(() => window.close(), 50);
  }, []);

  const message =
    status === "failed"
      ? "인증 결과를 전달하지 못했습니다. 창을 닫고 다시 시도해 주세요."
      : status === "sent"
        ? "인증 결과를 전달했습니다. 창을 닫아도 됩니다."
        : "인증 결과를 전달하는 중입니다.";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-10">
      <Script
        src={sdkUrl}
        strategy="afterInteractive"
        onReady={relayCallback}
        onLoad={relayCallback}
        onError={() => setStatus("failed")}
      />
      <p className="text-center text-sm font-medium text-muted-foreground">{message}</p>
    </main>
  );
}
