"use client";

import { useState } from "react";
import AppleWalletPassCard, {
  type AppleWalletPassStatus,
} from "@/components/certification/AppleWalletPassCard";
import InlineMessage from "@/components/ui/InlineMessage";
import { resolveAppleWalletCardStatusAfterRevoke } from "@/lib/wallet/wallet-pass-card-state";
import { APPLE_WALLET_CONSENT_VERSION } from "@/lib/wallet/wallet-pass-request";

type PendingAction = "issue" | "download" | "revoke" | null;

type AppleWalletPassSectionProps = {
  initialStatus: AppleWalletPassStatus;
  lastIssuedAt?: string | null;
  blockerMessage?: string | null;
  blockerActionHref?: string | null;
  blockerActionLabel?: string | null;
};

function createIdempotencyKey() {
  return crypto.randomUUID().replaceAll("-", "");
}

async function readApiResponse(response: Response) {
  try {
    return (await response.json()) as {
      ok?: boolean;
      downloadUrl?: string;
      message?: string;
    };
  } catch {
    return {};
  }
}

export default function AppleWalletPassSection({
  initialStatus,
  lastIssuedAt = null,
  blockerMessage = null,
  blockerActionHref = null,
  blockerActionLabel = null,
}: AppleWalletPassSectionProps) {
  const [status, setStatus] = useState(initialStatus);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleIssue = async () => {
    setPendingAction("issue");
    setErrorMessage(null);
    try {
      const response = await fetch("/api/wallet/apple/pass", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          consent: true,
          consentVersion: APPLE_WALLET_CONSENT_VERSION,
          idempotencyKey: createIdempotencyKey(),
        }),
      });
      const result = await readApiResponse(response);
      if (
        !response.ok ||
        result.ok !== true ||
        result.downloadUrl !== "/api/wallet/apple/pass"
      ) {
        throw new Error(result.message || "Apple Wallet 패스를 발급하지 못했어요.");
      }
      setStatus("active");
      window.location.assign(result.downloadUrl);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Apple Wallet 패스를 발급하지 못했어요.",
      );
    } finally {
      setPendingAction(null);
    }
  };

  const handleDownload = () => {
    setPendingAction("download");
    setErrorMessage(null);
    window.location.assign("/api/wallet/apple/pass");
  };

  const handleRevoke = async () => {
    if (!window.confirm("현재 Apple Wallet 패스를 폐기할까요? 기기에 남은 패스의 QR도 더 이상 인증되지 않습니다.")) {
      return;
    }
    setPendingAction("revoke");
    setErrorMessage(null);
    try {
      const response = await fetch("/api/wallet/apple/pass", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: createIdempotencyKey(),
          reason: "member_requested",
        }),
      });
      const result = await readApiResponse(response);
      if (!response.ok || result.ok !== true) {
        throw new Error(result.message || "Apple Wallet 패스를 폐기하지 못했어요.");
      }
      setStatus(resolveAppleWalletCardStatusAfterRevoke(status));
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Apple Wallet 패스를 폐기하지 못했어요.",
      );
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <section aria-label="Apple Wallet 회원 인증" className="space-y-3">
      {errorMessage ? (
        <InlineMessage
          tone="danger"
          title="Apple Wallet 오류"
          description={errorMessage}
          ariaLive="assertive"
        />
      ) : null}
      <AppleWalletPassCard
        status={status}
        lastIssuedAt={lastIssuedAt}
        blockerMessage={blockerMessage}
        blockerActionHref={blockerActionHref}
        blockerActionLabel={blockerActionLabel}
        pendingAction={pendingAction}
        onIssue={
          status === "not_issued" ||
          status === "revoked" ||
          status === "consent_required" ||
          status === "error"
            ? handleIssue
            : undefined
        }
        onDownload={status === "active" ? handleDownload : undefined}
        onRevoke={
          status === "active" || status === "active_unavailable"
            ? handleRevoke
            : undefined
        }
      />
    </section>
  );
}
